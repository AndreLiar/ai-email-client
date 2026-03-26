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
- If scan results are provided below, use them directly — do NOT call scanInbox again.
- Classify senders using classifySenders before taking action if categories are unknown.
- Execute delete/unsubscribe actions immediately when the user asks — do not ask for extra confirmation unless the sender looks transactional.
- Flag "transactional" senders (banks, Stripe, receipts) as risky — warn before deleting.
- Be concise. After each action, report what was done and how many emails were affected.`;

  if (scanContext && scanContext.senders.length > 0) {
    const topSenders = scanContext.senders.slice(0, 40);
    prompt += `\n\n## SCAN RESULTS (already available — do NOT call scanInbox)\n`;
    prompt += `Total stale unread emails: ${scanContext.total}. Total senders found: ${scanContext.senders.length} (showing top ${topSenders.length}).\n`;
    prompt += `Senders (sorted by email count):\n`;
    for (const s of topSenders) {
      prompt += `- "${s.displayName}" <${s.email}>: ${s.count} emails, autoUnsub: ${s.canAutoUnsubscribe}\n`;
    }
    prompt += `\nWhen the user asks to delete/unsubscribe by category, call classifySenders first (pass ALL listed senders) to identify which belong to that category, then act on them.`;
  }

  return prompt;
}
