import { getValidAccessToken } from '@/services/auth';
import { listMessages, getMessageMetadata, parseFromHeader } from '@/services/gmail';
import type { SenderInfo } from '@/types/email';
import { auth } from '@clerk/nextjs/server';

export const maxDuration = 60;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response(
      `data: ${JSON.stringify({ phase: 'error', message: 'Error: Unauthorized' })}\n\n`,
      {
        status: 401,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        send({ phase: 'init', message: 'Connecting to Gmail API...' });

        const accessToken = await getValidAccessToken(userId);

        // ── Phase 1: collect all unread email IDs older than 6 months ──────
        send({ phase: 'ids', message: 'Scanning mailbox for unread emails older than 6 months...' });

        const ids: string[] = [];
        let pageToken: string | undefined;

        do {
          const data = await listMessages(accessToken, 'is:unread older_than:180d', 500, pageToken);
          for (const m of data.messages || []) ids.push(m.id);
          pageToken = data.nextPageToken;
          send({ phase: 'ids', message: `Found ${ids.length.toLocaleString()} emails so far...`, count: ids.length });
        } while (pageToken && ids.length < 5000);

        if (ids.length === 0) {
          send({ phase: 'done', message: 'No stale unread emails found. Your inbox is clean!', result: { senders: [], total: 0 } });
          controller.close();
          return;
        }

        send({ phase: 'ids_done', message: `Found ${ids.length.toLocaleString()} stale emails. Fetching details...`, count: ids.length });

        // ── Phase 2: fetch metadata in batches of 100 ───────────────────────
        const BATCH = 100;
        const metadataList: Awaited<ReturnType<typeof getMessageMetadata>>[] = [];

        for (let i = 0; i < ids.length; i += BATCH) {
          const chunk = ids.slice(i, i + BATCH);
          const results = await Promise.all(
            chunk.map(id =>
              getMessageMetadata(accessToken, id, ['From', 'List-Unsubscribe', 'List-Unsubscribe-Post'])
                .catch(() => null)
            )
          );
          metadataList.push(...(results.filter(Boolean) as typeof metadataList));

          const pct = Math.min(Math.round(((i + chunk.length) / ids.length) * 100), 100);
          send({ phase: 'metadata', message: `Fetching email details... ${pct}%`, progress: pct, done: i + chunk.length, total: ids.length });
        }

        // ── Phase 3: group by sender ─────────────────────────────────────────
        send({ phase: 'grouping', message: 'Grouping emails by sender...' });

        const senderMap = new Map<string, SenderInfo>();

        for (const msg of metadataList) {
          if (!msg.payload?.headers) continue;

          const headers = msg.payload.headers;
          const fromHeader = headers.find(h => h.name === 'From')?.value || '';
          const listUnsub = headers.find(h => h.name === 'List-Unsubscribe')?.value || null;
          const listUnsubPost = !!headers.find(h => h.name === 'List-Unsubscribe-Post');
          const internalDate = parseInt(msg.internalDate || '0');

          const { email, displayName } = parseFromHeader(fromHeader);
          if (!email || !email.includes('@')) continue;

          if (!senderMap.has(email)) {
            senderMap.set(email, {
              displayName, email, count: 0, messageIds: [],
              sampleMessageId: msg.id,
              listUnsubscribe: null, listUnsubscribePost: false, canAutoUnsubscribe: false,
              oldestDate: internalDate, newestDate: internalDate,
            });
          }

          const sender = senderMap.get(email)!;
          sender.count++;
          sender.messageIds.push(msg.id);
          if (internalDate && internalDate < sender.oldestDate) sender.oldestDate = internalDate;
          if (internalDate && internalDate > sender.newestDate) sender.newestDate = internalDate;

          if (listUnsub && !sender.listUnsubscribe) {
            sender.listUnsubscribe = listUnsub;
            sender.listUnsubscribePost = listUnsubPost;
            sender.sampleMessageId = msg.id;
            sender.canAutoUnsubscribe = listUnsubPost || /mailto:/i.test(listUnsub);
          }
        }

        const senders = Array.from(senderMap.values())
          .filter(s => s.count >= 2)
          .sort((a, b) => b.count - a.count);

        send({
          phase: 'done',
          message: `Done. ${senders.length} repetitive senders identified across ${ids.length.toLocaleString()} stale emails.`,
          result: { senders, total: ids.length },
        });

        controller.close();
      } catch (err: any) {
        send({ phase: 'error', message: `Error: ${err.message}` });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
