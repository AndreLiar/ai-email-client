import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import type { ScanResult } from '@/types/agent';

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

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

export async function classifyWithFallback(prompt: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (res.status === 429) throw new Error('rate_limit');
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
    throw new Error('empty_response');
  } catch {
    console.warn('[classifySenders] Gemini failed — falling back to Groq');
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt,
    });
    return text;
  }
}

export function buildSystemPrompt(scanContext?: ScanResult): string {
  let prompt = `You are an Inbox Cleaner Agent. Your job is to help users clean their Gmail inbox.

Rules:
- SCAN_CONTEXT is already loaded below — do NOT call scanInbox under any circumstances when scan results are present.
- When asked to analyze or recommend: respond with a brief structured summary grouped by likely category. Infer categories from sender names — do NOT call classifySenders just to analyze.
- Only call classifySenders when the user wants to act on a specific category and you need confirmed classifications to identify which senders belong to it. Pass ALL relevant senders from the list below.
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
