import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import type { EmailDecision, ScanResult } from '@/types/agent';

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const decisionActionSchema = z.enum(['delete', 'archive', 'keep', 'reply']);

const replyDraftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

const emailDecisionSchema = z.object({
  messageId: z.string().min(1),
  threadId: z.string().optional(),
  action: decisionActionSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  replyDraft: replyDraftSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.action === 'reply' && !value.replyDraft) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'replyDraft is required when action is "reply".',
      path: ['replyDraft'],
    });
  }
});

const decisionResponseSchema = z.object({
  decisions: z.array(emailDecisionSchema),
});

export interface DecisionPolicy {
  deleteThreshold: number;
  archiveThreshold: number;
  allowReply: boolean;
  highRiskKeywords: string[];
}

export interface DecisionEmailInput {
  messageId: string;
  threadId?: string;
  from: string;
  subject: string;
  snippet: string;
  labels: string[];
  ageDays?: number;
}

export interface DecideEmailActionsInput {
  policy: DecisionPolicy;
  emails: DecisionEmailInput[];
}

export async function selectModel(): Promise<{
  model: ReturnType<typeof google> | ReturnType<typeof groq>;
  provider: 'gemini' | 'groq';
}> {
  try {
    const probe = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: '1' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
        signal: AbortSignal.timeout(4000),
      }
    );
    if (probe.status === 429) {
      console.warn('[AI] Gemini rate limited — switching to Groq llama-3.3-70b-versatile');
      return { model: groq('llama-3.3-70b-versatile'), provider: 'groq' };
    }
    return { model: google('gemini-2.0-flash'), provider: 'gemini' };
  } catch {
    console.warn('[AI] Gemini probe failed — switching to Groq llama-3.3-70b-versatile');
    return { model: groq('llama-3.3-70b-versatile'), provider: 'groq' };
  }
}

export async function classifyAllSenders(
  senders: { email: string; displayName: string }[]
): Promise<{ email: string; category: string }[]> {
  console.info('[ai] classifyAllSenders start', { totalSenders: senders.length });
  const BATCH = 30;
  const results: { email: string; category: string }[] = [];

  for (let i = 0; i < senders.length; i += BATCH) {
    const batch = senders.slice(i, i + BATCH);
    const prompt = `Classify each of these email senders into one category.
Categories: newsletter, job_alert, promo, social, transactional, other.
"transactional" = banks, receipts, security alerts, payment processors.

Senders:
${batch.map((s, j) => `${j + 1}. "${s.displayName}" <${s.email}>`).join('\n')}

Respond ONLY with a JSON array like:
[{"email":"...","category":"..."},...]`;

    const text = await classifyWithFallback(prompt);
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) results.push(...JSON.parse(jsonMatch[0]));
    } catch {
      console.warn('[ai] classifyAllSenders malformed batch response', { batchStart: i, batchSize: batch.length });
      /* skip malformed batch */
    }
  }

  console.info('[ai] classifyAllSenders done', { classified: results.length, requested: senders.length });
  return results;
}

export async function classifyWithFallback(prompt: string): Promise<string> {
  return generateTextWithFallback(prompt, 'classifySenders', 12000);
}

function extractJsonObject(text: string): unknown {
  const candidates: string[] = [];
  const fencedJson = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJson?.[1]) candidates.push(fencedJson[1].trim());

  const objectCandidate = text.match(/\{[\s\S]*\}/);
  if (objectCandidate?.[0]) candidates.push(objectCandidate[0].trim());

  candidates.push(text.trim());

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate shape.
    }
  }

  throw new Error('Model response is not valid JSON.');
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

async function generateTextWithFallback(prompt: string, context: string, timeoutMs = 25000): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
    if (res.status === 429) throw new Error('rate_limit');
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      console.info(`[${context}] provider=gemini`);
      return text;
    }
    throw new Error('empty_response');
  } catch (err: any) {
    console.warn(`[${context}] Gemini failed — falling back to Groq`, {
      error: err?.message || err,
    });
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt,
    });
    console.info(`[${context}] provider=groq`);
    return text;
  }
}

export function buildDecisionPrompt(
  policy: DecisionPolicy,
  emails: DecisionEmailInput[]
): string {
  const compactEmails = emails.map(email => ({
    messageId: email.messageId,
    threadId: email.threadId,
    from: email.from,
    subject: email.subject,
    snippet: email.snippet,
    labels: email.labels,
    ageDays: email.ageDays,
  }));

  return `You are an email triage decision engine.

Policy:
${JSON.stringify(policy, null, 2)}

For each email, choose exactly one action: delete, archive, keep, or reply.
Confidence must be a number between 0 and 1.
Use "reply" only if policy.allowReply is true.
If action is "reply", include a concise replyDraft with subject and body.

Return ONLY valid JSON matching this shape:
{
  "decisions": [
    {
      "messageId": "string",
      "threadId": "string (optional)",
      "action": "delete|archive|keep|reply",
      "confidence": 0.0,
      "reason": "short explanation",
      "replyDraft": { "subject": "string", "body": "string" }
    }
  ]
}

Emails:
${JSON.stringify(compactEmails, null, 2)}`;
}

export async function decideEmailActions({
  policy,
  emails,
}: DecideEmailActionsInput): Promise<EmailDecision[]> {
  if (emails.length === 0) {
    console.info('[ai] decideEmailActions skipped (no emails)');
    return [];
  }

  console.info('[ai] decideEmailActions start', {
    emails: emails.length,
    deleteThreshold: policy.deleteThreshold,
    archiveThreshold: policy.archiveThreshold,
    allowReply: policy.allowReply,
  });

  const prompt = buildDecisionPrompt(policy, emails);
  const raw = await generateTextWithFallback(prompt, 'decideEmailActions');
  const parsedJson = extractJsonObject(raw);

  const parsed = decisionResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.error('[ai] decideEmailActions invalid schema', {
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    const first = parsed.error.issues[0];
    throw new Error(`Invalid decision payload: ${first?.message ?? 'unknown schema error'}`);
  }

  const byMessageId = new Map(parsed.data.decisions.map(decision => [decision.messageId, decision]));

  const finalDecisions = emails.map((email): EmailDecision => {
    const decision = byMessageId.get(email.messageId);
    if (!decision) {
      return {
        messageId: email.messageId,
        threadId: email.threadId,
        action: 'keep',
        confidence: 0,
        reason: 'No model decision returned for this message.',
      };
    }

    return {
      messageId: decision.messageId,
      threadId: decision.threadId ?? email.threadId,
      action: decision.action,
      confidence: clamp01(decision.confidence),
      reason: decision.reason.trim(),
      ...(decision.action === 'reply' && decision.replyDraft ? { replyDraft: decision.replyDraft } : {}),
    };
  });

  const summary = {
    delete: finalDecisions.filter(d => d.action === 'delete').length,
    archive: finalDecisions.filter(d => d.action === 'archive').length,
    keep: finalDecisions.filter(d => d.action === 'keep').length,
    reply: finalDecisions.filter(d => d.action === 'reply').length,
  };

  console.info('[ai] decideEmailActions done', {
    total: finalDecisions.length,
    summary,
  });

  return finalDecisions;
}

export function buildSystemPrompt(scanContext?: ScanResult): string {
  let prompt = `You are an Inbox Cleaner Agent. Your job is to help users clean their Gmail inbox.

Rules:
- SCAN_CONTEXT is already loaded below — do NOT call scanInbox under any circumstances when scan results are present.
- When asked to analyze or recommend: respond with a brief structured summary grouped by likely category. Infer categories from sender names — do NOT call classifySenders just to analyze.
- When the user wants to classify senders: call classifyAllSenders (no arguments) — it handles all senders automatically. Never pass a large array to classifySenders.
- Only use classifySenders (with explicit senders array) for a small targeted subset (max 20 senders).
- Execute delete/unsubscribe actions immediately when asked — no extra confirmation unless the sender looks transactional.
- Flag "transactional" senders (banks, Stripe, receipts, security alerts) as risky — warn before deleting.
- Be concise. After each action, report what was done and how many emails were affected.`;

  if (scanContext && scanContext.senders.length > 0) {
    const senders = scanContext.senders;
    const autoUnsubCount = senders.filter(s => s.canAutoUnsubscribe).length;

    prompt += `\n\n## SCAN_CONTEXT — ${senders.length} senders, ${scanContext.total.toLocaleString()} stale unread emails`;
    prompt += `\nAuto-unsubscribable: ${autoUnsubCount} of ${senders.length} senders`;
    prompt += `\n\nFull sender list (name <email>: count [AUTO] if one-click unsubscribe supported):\n`;

    for (const s of senders) {
      const auto = s.canAutoUnsubscribe ? ' [AUTO]' : '';
      prompt += `- "${s.displayName}" <${s.email}>: ${s.count}${auto}\n`;
    }

    prompt += `\nIMPORTANT: All ${senders.length} senders above are available. When acting on a category, classify and act on ALL matching senders — not just a subset.`;
  }

  return prompt;
}
