// src/app/api/agent/scan-senders/route.ts
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

export interface SenderInfo {
  displayName: string;
  email: string;
  count: number;
  messageIds: string[];
  sampleMessageId: string;
  listUnsubscribe: string | null;
  listUnsubscribePost: boolean;
  canAutoUnsubscribe: boolean;
  oldestDate: number; // ms timestamp of oldest unread email from this sender
  newestDate: number; // ms timestamp of newest unread email from this sender
}

// Paginate through ALL unread emails older than 6 months (up to maxTotal)
async function fetchStaleIds(accessToken: string, maxTotal = 5000): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ maxResults: '500', q: 'is:unread older_than:180d' });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${GMAIL_API}/users/me/messages?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();

    for (const m of data.messages || []) ids.push(m.id);
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < maxTotal);

  return ids;
}

// Fetch message metadata in parallel batches to respect rate limits
async function fetchMetadataBatch(
  accessToken: string,
  ids: string[],
  batchSize = 200
): Promise<any[]> {
  const results: any[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const batch = await Promise.all(
      chunk.map(id =>
        fetch(
          `${GMAIL_API}/users/me/messages/${id}?format=metadata` +
            `&metadataHeaders=From` +
            `&metadataHeaders=List-Unsubscribe` +
            `&metadataHeaders=List-Unsubscribe-Post`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then(r => r.json())
      )
    );
    results.push(...batch);
  }

  return results;
}

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();

    // Step 1: collect all unread email IDs older than 6 months
    const ids = await fetchStaleIds(accessToken);

    if (ids.length === 0) {
      return NextResponse.json({ senders: [], total: 0 });
    }

    // Step 2: fetch metadata for all of them in batches
    const metadataList = await fetchMetadataBatch(accessToken, ids);

    // Step 3: group by sender
    const senderMap = new Map<string, SenderInfo>();

    for (const msg of metadataList) {
      if (!msg.payload?.headers) continue;

      const headers: { name: string; value: string }[] = msg.payload.headers;
      const fromHeader = headers.find(h => h.name === 'From')?.value || '';
      const listUnsub = headers.find(h => h.name === 'List-Unsubscribe')?.value || null;
      const listUnsubPost = !!headers.find(h => h.name === 'List-Unsubscribe-Post');
      const internalDate = parseInt(msg.internalDate || '0'); // ms since epoch

      const angleMatch = fromHeader.match(/<([^>]+@[^>]+)>/);
      const plainMatch = fromHeader.match(/([^\s]+@[^\s]+)/);
      const email = (angleMatch?.[1] || plainMatch?.[1] || fromHeader).toLowerCase().trim();
      const displayName = fromHeader.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || email;

      if (!email || !email.includes('@')) continue;

      if (!senderMap.has(email)) {
        senderMap.set(email, {
          displayName,
          email,
          count: 0,
          messageIds: [],
          sampleMessageId: msg.id,
          listUnsubscribe: null,
          listUnsubscribePost: false,
          canAutoUnsubscribe: false,
          oldestDate: internalDate,
          newestDate: internalDate,
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

    // Step 4: keep only repetitive senders (2+ emails), sort by count desc
    const senders = Array.from(senderMap.values())
      .filter(s => s.count >= 2)
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ senders, total: ids.length });
  } catch (err: any) {
    console.error('Scan senders error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
