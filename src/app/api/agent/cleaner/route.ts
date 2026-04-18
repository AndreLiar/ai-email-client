import { getValidAccessToken } from '@/services/auth';
import { listMessages, getMessageMetadata, trashAllFromSender, performUnsubscribe, parseFromHeader } from '@/services/gmail';
import { selectModel, classifyWithFallback, classifyAllSenders, buildSystemPrompt } from '@/services/ai';
import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { z } from 'zod';
import type { UIMessage } from 'ai';
import type { ScanResult } from '@/types/agent';
import { auth } from '@clerk/nextjs/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, scanContext }: { messages: UIMessage[]; scanContext?: ScanResult } = await req.json();

  let accessToken: string;
  try {
    const { userId } = await auth();
    if (!userId) return new Response('Unauthorized', { status: 401 });
    accessToken = await getValidAccessToken(userId);
  } catch {
    return new Response('Gmail not connected', { status: 403 });
  }

  const modelMessages = await convertToModelMessages(messages);
  const { model, provider } = await selectModel();

  console.log(`[AI Agent] Using model: ${provider}`);

  const tools = {
    // ── Tool 1: Scan inbox ────────────────────────────────────────────────
    scanInbox: tool({
      description: 'Scan the inbox for stale unread emails. Only call this if no scan results were provided in the system prompt.',
      inputSchema: z.object({}),
      execute: async () => {
        // Uses the same query as the main scan endpoint for consistency
        const data = await listMessages(accessToken, 'is:unread older_than:180d', 500);
        const ids = (data.messages || []).map(m => m.id);

        const metadataList = await Promise.all(
          ids.map(id =>
            getMessageMetadata(accessToken, id, ['From', 'List-Unsubscribe', 'List-Unsubscribe-Post'])
              .catch(() => null)
          )
        );

        const senderMap = new Map<string, {
          displayName: string; email: string; count: number;
          sampleMessageId: string; canAutoUnsubscribe: boolean;
        }>();

        for (const msg of metadataList) {
          if (!msg?.payload?.headers) continue;
          const headers = msg.payload.headers;
          const fromHeader = headers.find(h => h.name === 'From')?.value || '';
          const listUnsub = headers.find(h => h.name === 'List-Unsubscribe')?.value || '';
          const hasPost = !!headers.find(h => h.name === 'List-Unsubscribe-Post');

          const { email, displayName } = parseFromHeader(fromHeader);
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
          totalScanned: ids.length,
        };
      },
    }),

    // ── Tool 2a: Classify ALL senders from scan context (no args — avoids large array generation) ──
    classifyAllSenders: tool({
      description: 'Classify ALL senders from the scan results into categories. Use this when the user asks to classify all senders or their full inbox. Takes no arguments.',
      inputSchema: z.object({}),
      execute: async () => {
        const senders = (scanContext?.senders ?? []).map(s => ({
          email: s.email,
          displayName: s.displayName,
        }));
        if (senders.length === 0) return { classifications: [] };
        const classifications = await classifyAllSenders(senders);
        return { classifications };
      },
    }),

    // ── Tool 2b: Classify a small subset of senders (max 20) ─────────────
    classifySenders: tool({
      description: 'Classify a small subset of senders (max 20) by passing them explicitly. Use classifyAllSenders instead when classifying the full list.',
      inputSchema: z.object({
        senders: z.array(z.object({ email: z.string(), displayName: z.string() })).max(20),
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
        const deleted = await trashAllFromSender(accessToken, senderEmail);
        return { deleted, senderEmail };
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
        const result = await performUnsubscribe(accessToken, messageId);
        return { ...result, senderEmail };
      },
    }),
  };

  const result = streamText({
    model,
    stopWhen: stepCountIs(10),
    system: buildSystemPrompt(scanContext),
    messages: modelMessages,
    tools,
  });

  return result.toUIMessageStreamResponse();
}
