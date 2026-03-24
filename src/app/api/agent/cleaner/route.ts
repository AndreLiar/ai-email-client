// src/app/api/agent/cleaner/route.ts
// Vercel AI SDK v6 streaming agent — Gemini 2.0 Flash with Groq llama-3.3-70b-versatile fallback
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { formatEmailAsMime } from '@/lib/formatEmailAsMime';
import { streamText, generateText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
import { z } from 'zod';

export const maxDuration = 60;

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// Probe Gemini with a 1-token call to detect rate limiting before starting the real stream
async function selectModel() {
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
      return { model: groq('llama-3.3-70b-versatile'), provider: 'groq' as const };
    }
    return { model: google('gemini-2.0-flash'), provider: 'gemini' as const };
  } catch {
    console.warn('[AI] Gemini probe failed — switching to Groq llama-3.3-70b-versatile');
    return { model: groq('llama-3.3-70b-versatile'), provider: 'groq' as const };
  }
}

// Classify senders via Gemini REST, fall back to Groq generateText on rate limit / error
async function classifyWithFallback(prompt: string): Promise<string> {
  // Try Gemini REST first
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

export async function POST(req: Request) {
  const { messages, scanContext } = await req.json();

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken();
  } catch {
    return new Response('Gmail not connected', { status: 403 });
  }

  const modelMessages = await convertToModelMessages(messages);
  const { model, provider } = await selectModel();

  console.log(`[AI Agent] Using model: ${provider}`);

  const tools = {
    // ── Tool 1: Scan inbox ────────────────────────────────────────────────
    scanInbox: tool({
      description: 'Scan the inbox and return a grouped list of senders with email counts and unsubscribe capability.',
      inputSchema: z.object({}),
      execute: async () => {
        const [promoRes, updatesRes, inboxRes] = await Promise.all([
          fetch(`${GMAIL_API}/users/me/messages?maxResults=100&q=category:promotions`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then(r => r.json()),
          fetch(`${GMAIL_API}/users/me/messages?maxResults=100&q=category:updates`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then(r => r.json()),
          fetch(`${GMAIL_API}/users/me/messages?maxResults=100&q=in:inbox is:unread`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then(r => r.json()),
        ]);

        const allMessages = [
          ...(promoRes.messages || []),
          ...(updatesRes.messages || []),
          ...(inboxRes.messages || []),
        ];
        const unique = Array.from(new Map(allMessages.map((m: any) => [m.id, m])).values());

        const metadataList = await Promise.all(
          unique.map((msg: any) =>
            fetch(
              `${GMAIL_API}/users/me/messages/${msg.id}?format=metadata` +
                `&metadataHeaders=From&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            ).then(r => r.json())
          )
        );

        const senderMap = new Map<string, {
          displayName: string; email: string; count: number;
          sampleMessageId: string; canAutoUnsubscribe: boolean;
        }>();

        for (const msg of metadataList) {
          if (!msg.payload?.headers) continue;
          const headers: { name: string; value: string }[] = msg.payload.headers;
          const fromHeader = headers.find(h => h.name === 'From')?.value || '';
          const listUnsub = headers.find(h => h.name === 'List-Unsubscribe')?.value || '';
          const hasPost = !!headers.find(h => h.name === 'List-Unsubscribe-Post');

          const angleMatch = fromHeader.match(/<([^>]+@[^>]+)>/);
          const plainMatch = fromHeader.match(/([^\s]+@[^\s]+)/);
          const email = (angleMatch?.[1] || plainMatch?.[1] || '').toLowerCase().trim();
          const displayName = fromHeader.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || email;

          if (!email || !email.includes('@')) continue;

          if (!senderMap.has(email)) {
            senderMap.set(email, { displayName, email, count: 0, sampleMessageId: msg.id, canAutoUnsubscribe: false });
          }
          const sender = senderMap.get(email)!;
          sender.count++;
          if (listUnsub && !sender.canAutoUnsubscribe) {
            sender.canAutoUnsubscribe = hasPost || /mailto:/i.test(listUnsub);
            sender.sampleMessageId = msg.id;
          }
        }

        return {
          senders: Array.from(senderMap.values()).sort((a, b) => b.count - a.count),
          totalScanned: unique.length,
        };
      },
    }),

    // ── Tool 2: Classify senders (Gemini → Groq fallback) ─────────────────
    classifySenders: tool({
      description: 'Classify a list of sender names/emails into categories: newsletter, job_alert, promo, social, transactional, other.',
      inputSchema: z.object({
        senders: z.array(z.object({ email: z.string(), displayName: z.string() })),
      }),
      execute: async ({ senders }) => {
        const prompt = `Classify each of these email senders into one category.
Categories: newsletter, job_alert, promo, social, transactional, other.
"transactional" = banks, receipts, security alerts, payment processors.

Senders:
${senders.map((s, i) => `${i + 1}. "${s.displayName}" <${s.email}>`).join('\n')}

Respond ONLY with a JSON array like:
[{"email":"...","category":"..."},...]`;

        const text = await classifyWithFallback(prompt);

        try {
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          return { classifications: jsonMatch ? JSON.parse(jsonMatch[0]) : [] };
        } catch {
          return { classifications: [] };
        }
      },
    }),

    // ── Tool 3: Delete all emails from a sender ───────────────────────────
    deleteEmailsFromSender: tool({
      description: 'Move all emails from a specific sender to Trash.',
      inputSchema: z.object({
        senderEmail: z.string().describe('The exact email address to delete emails from'),
      }),
      execute: async ({ senderEmail }) => {
        let allIds: string[] = [];
        let pageToken: string | undefined;

        do {
          const url =
            `${GMAIL_API}/users/me/messages?maxResults=500` +
            `&q=${encodeURIComponent(`from:${senderEmail}`)}` +
            (pageToken ? `&pageToken=${pageToken}` : '');
          const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
          const data = await res.json();
          allIds = allIds.concat((data.messages || []).map((m: any) => m.id));
          pageToken = data.nextPageToken;
        } while (pageToken && allIds.length < 1000);

        if (allIds.length === 0) return { deleted: 0, senderEmail };

        for (let i = 0; i < allIds.length; i += 1000) {
          await fetch(`${GMAIL_API}/users/me/messages/batchModify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ids: allIds.slice(i, i + 1000),
              addLabelIds: ['TRASH'],
              removeLabelIds: ['INBOX', 'UNREAD'],
            }),
          });
        }

        return { deleted: allIds.length, senderEmail };
      },
    }),

    // ── Tool 4: Unsubscribe from a sender ─────────────────────────────────
    unsubscribeFromSender: tool({
      description: 'Attempt to unsubscribe from a sender using their List-Unsubscribe header.',
      inputSchema: z.object({
        messageId: z.string().describe('A sample message ID from this sender'),
        senderEmail: z.string().describe('Sender email address (for logging)'),
      }),
      execute: async ({ messageId, senderEmail }) => {
        const res = await fetch(
          `${GMAIL_API}/users/me/messages/${messageId}?format=metadata` +
            `&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msg = await res.json();
        const headers: { name: string; value: string }[] = msg.payload?.headers || [];

        const listUnsub = headers.find(h => h.name === 'List-Unsubscribe')?.value || '';
        const hasPost = !!headers.find(h => h.name === 'List-Unsubscribe-Post');

        if (!listUnsub) return { method: 'none', senderEmail };

        const mailtoMatch = listUnsub.match(/<mailto:([^>]+)>/i);
        const httpsMatch = listUnsub.match(/<(https?:\/\/[^>]+)>/i);

        if (httpsMatch && hasPost) {
          await fetch(httpsMatch[1], {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'List-Unsubscribe=One-Click',
          });
          return { method: 'one-click-post', url: httpsMatch[1], senderEmail };
        }

        if (mailtoMatch) {
          const [to, qs] = mailtoMatch[1].split('?');
          const subject = new URLSearchParams(qs || '').get('subject') || 'Unsubscribe';
          const raw = formatEmailAsMime(to, subject, 'Please remove me from this mailing list.');
          await fetch(`${GMAIL_API}/users/me/messages/send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw }),
          });
          return { method: 'mailto', to, senderEmail };
        }

        if (httpsMatch) return { method: 'link', url: httpsMatch[1], senderEmail };
        return { method: 'none', senderEmail };
      },
    }),
  };

  // Build system prompt — inject scan context if available so agent skips re-scanning
  let systemPrompt = `You are an Inbox Cleaner Agent. Your job is to help users clean their Gmail inbox.

Rules:
- If scan results are provided below, use them directly — do NOT call scanInbox again.
- Classify senders using classifySenders before taking action if categories are unknown.
- Execute delete/unsubscribe actions immediately when the user asks — do not ask for extra confirmation unless the sender looks transactional.
- Flag "transactional" senders (banks, Stripe, receipts) as risky — warn before deleting.
- Be concise. After each action, report what was done and how many emails were affected.`;

  if (scanContext?.senders?.length > 0) {
    // Cap at 40 senders — longer lists cause Gemini to generate invalid tool calls
    const topSenders = scanContext.senders.slice(0, 40);
    systemPrompt += `\n\n## SCAN RESULTS (already available — do NOT call scanInbox)\n`;
    systemPrompt += `Total stale unread emails: ${scanContext.total}. Total senders found: ${scanContext.senders.length} (showing top ${topSenders.length}).\n`;
    systemPrompt += `Senders (sorted by email count):\n`;
    for (const s of topSenders) {
      systemPrompt += `- "${s.displayName}" <${s.email}>: ${s.count} emails, autoUnsub: ${s.canAutoUnsubscribe}\n`;
    }
    systemPrompt += `\nWhen the user asks to delete/unsubscribe by category, call classifySenders first (pass ALL listed senders) to identify which belong to that category, then act on them.`;
  }

  const result = streamText({
    model,
    stopWhen: stepCountIs(10),
    system: systemPrompt,

    messages: modelMessages,
    tools,
  });

  return result.toUIMessageStreamResponse();
}
