// src/app/api/agent/cleaner/route.ts
// Vercel AI SDK v6 streaming agent with Gemini 1.5 Flash
// Uses tool calling to orchestrate scan → classify → delete → unsubscribe
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { formatEmailAsMime } from '@/lib/formatEmailAsMime';
import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const maxDuration = 60; // Vercel streaming limit on free plan

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

export async function POST(req: Request) {
  const { messages } = await req.json();

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken();
  } catch {
    return new Response('Gmail not connected', { status: 403 });
  }

  // Convert UIMessage[] (from client) to ModelMessage[] (for streamText)
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google('gemini-1.5-flash'),
    stopWhen: stepCountIs(10),
    system: `You are an Inbox Cleaner Agent. Your job is to help users clean their Gmail inbox by:
1. Scanning their inbox to find senders grouped by volume
2. Classifying senders (newsletter, job_alert, promo, social, transactional, other)
3. Executing unsubscribe and/or bulk delete actions when asked

Rules:
- Always scan before taking action unless you already have scan results
- Ask for confirmation before deleting or unsubscribing in bulk
- Flag "transactional" senders (banks, Stripe, receipts) as risky to delete — warn the user
- Be concise. Present sender groups as a clear table in markdown.
- After each action, report what was done and how many emails were affected.`,

    messages: modelMessages,

    tools: {
      // ── Tool 1: Scan inbox and group by sender ──────────────────────────
      scanInbox: tool({
        description:
          'Scan the inbox and return a grouped list of senders with email counts and unsubscribe capability.',
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
          const unique = Array.from(
            new Map(allMessages.map((m: any) => [m.id, m])).values()
          );

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
            displayName: string;
            email: string;
            count: number;
            sampleMessageId: string;
            canAutoUnsubscribe: boolean;
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
            const displayName =
              fromHeader.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || email;

            if (!email || !email.includes('@')) continue;

            if (!senderMap.has(email)) {
              senderMap.set(email, {
                displayName,
                email,
                count: 0,
                sampleMessageId: msg.id,
                canAutoUnsubscribe: false,
              });
            }
            const sender = senderMap.get(email)!;
            sender.count++;
            if (listUnsub && !sender.canAutoUnsubscribe) {
              sender.canAutoUnsubscribe = hasPost || /mailto:/i.test(listUnsub);
              sender.sampleMessageId = msg.id;
            }
          }

          const senders = Array.from(senderMap.values()).sort((a, b) => b.count - a.count);
          return { senders, totalScanned: unique.length };
        },
      }),

      // ── Tool 2: Classify senders by category ────────────────────────────
      classifySenders: tool({
        description:
          'Classify a list of sender names/emails into categories: newsletter, job_alert, promo, social, transactional, other.',
        inputSchema: z.object({
          senders: z.array(
            z.object({ email: z.string(), displayName: z.string() })
          ),
        }),
        execute: async ({ senders }) => {
          const prompt = `Classify each of these email senders into one category.
Categories: newsletter, job_alert, promo, social, transactional, other.
"transactional" = banks, receipts, security alerts, payment processors.

Senders:
${senders.map((s, i) => `${i + 1}. "${s.displayName}" <${s.email}>`).join('\n')}

Respond ONLY with a JSON array like:
[{"email":"...","category":"..."},...]`;

          const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
          );
          const data = await aiRes.json();
          const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

          try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            const classifications = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
            return { classifications };
          } catch {
            return { classifications: [] };
          }
        },
      }),

      // ── Tool 3: Delete all emails from a sender ──────────────────────────
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

          const CHUNK = 1000;
          for (let i = 0; i < allIds.length; i += CHUNK) {
            await fetch(`${GMAIL_API}/users/me/messages/batchModify`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ids: allIds.slice(i, i + CHUNK),
                addLabelIds: ['TRASH'],
                removeLabelIds: ['INBOX', 'UNREAD'],
              }),
            });
          }

          return { deleted: allIds.length, senderEmail };
        },
      }),

      // ── Tool 4: Unsubscribe from a sender ────────────────────────────────
      unsubscribeFromSender: tool({
        description:
          'Attempt to unsubscribe from a sender using their List-Unsubscribe header.',
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
            const params = new URLSearchParams(qs || '');
            const subject = params.get('subject') || 'Unsubscribe';
            const raw = formatEmailAsMime(to, subject, 'Please remove me from this mailing list.');
            await fetch(`${GMAIL_API}/users/me/messages/send`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ raw }),
            });
            return { method: 'mailto', to, senderEmail };
          }

          if (httpsMatch) return { method: 'link', url: httpsMatch[1], senderEmail };

          return { method: 'none', senderEmail };
        },
      }),
    },
  });

  // v6: use toUIMessageStreamResponse() instead of toDataStreamResponse()
  return result.toUIMessageStreamResponse();
}
