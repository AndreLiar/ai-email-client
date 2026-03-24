// src/app/api/agent/scan-senders/route.ts
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { NextResponse } from 'next/server';

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
}

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();

    // Fetch 2 pages of 100 messages each from promotions + updates categories
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

    // Merge and deduplicate
    const allMessages = [
      ...(promoRes.messages || []),
      ...(updatesRes.messages || []),
      ...(inboxRes.messages || []),
    ];
    const unique = Array.from(new Map(allMessages.map((m: any) => [m.id, m])).values());

    // Fetch metadata for all messages in parallel (From + List-Unsubscribe headers)
    const metadataList = await Promise.all(
      unique.map((msg: any) =>
        fetch(
          `${GMAIL_API}/users/me/messages/${msg.id}?format=metadata` +
            `&metadataHeaders=From&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then(r => r.json())
      )
    );

    // Group by sender email
    const senderMap = new Map<string, SenderInfo>();

    for (const msg of metadataList) {
      if (!msg.payload?.headers) continue;
      const headers: { name: string; value: string }[] = msg.payload.headers;

      const fromHeader = headers.find(h => h.name === 'From')?.value || '';
      const listUnsub = headers.find(h => h.name === 'List-Unsubscribe')?.value || null;
      const listUnsubPost = !!headers.find(h => h.name === 'List-Unsubscribe-Post');

      // Parse "Display Name <email@domain.com>" or plain "email@domain.com"
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
        });
      }

      const sender = senderMap.get(email)!;
      sender.count++;
      sender.messageIds.push(msg.id);

      // Keep the first List-Unsubscribe header found for this sender
      if (listUnsub && !sender.listUnsubscribe) {
        sender.listUnsubscribe = listUnsub;
        sender.listUnsubscribePost = listUnsubPost;
        sender.sampleMessageId = msg.id;
        // Can auto-unsubscribe if has one-click POST or mailto
        sender.canAutoUnsubscribe =
          listUnsubPost || /mailto:/i.test(listUnsub);
      }
    }

    const senders = Array.from(senderMap.values()).sort((a, b) => b.count - a.count);

    return NextResponse.json({ senders, total: unique.length });
  } catch (err: any) {
    console.error('❌ Scan senders error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
