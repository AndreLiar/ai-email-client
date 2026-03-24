// src/app/api/agent/unsubscribe/route.ts
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { formatEmailAsMime } from '@/lib/formatEmailAsMime';
import { NextRequest, NextResponse } from 'next/server';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

export type UnsubscribeResult =
  | { method: 'one-click-post'; url: string }
  | { method: 'mailto'; to: string }
  | { method: 'link'; url: string }
  | { method: 'none'; message: string };

export async function POST(req: NextRequest) {
  const { messageId } = await req.json();
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });

  try {
    const accessToken = await getValidAccessToken();

    // Fetch the message metadata to get List-Unsubscribe header
    const res = await fetch(
      `${GMAIL_API}/users/me/messages/${messageId}?format=metadata` +
        `&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msg = await res.json();
    const headers: { name: string; value: string }[] = msg.payload?.headers || [];

    const listUnsub = headers.find(h => h.name === 'List-Unsubscribe')?.value || '';
    const hasOneClickPost = !!headers.find(h => h.name === 'List-Unsubscribe-Post');

    if (!listUnsub) {
      return NextResponse.json<UnsubscribeResult>({
        method: 'none',
        message: 'No List-Unsubscribe header found on this email.',
      });
    }

    // Parse mailto: and https: links from the header value
    // Format: <mailto:unsub@example.com?subject=Unsubscribe>, <https://example.com/unsub>
    const mailtoMatch = listUnsub.match(/<mailto:([^>]+)>/i);
    const httpsMatch = listUnsub.match(/<(https?:\/\/[^>]+)>/i);

    // Priority 1: One-click unsubscribe via HTTP POST (RFC 8058) — safest and most reliable
    if (httpsMatch && hasOneClickPost) {
      const unsubUrl = httpsMatch[1];
      await fetch(unsubUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      });
      return NextResponse.json<UnsubscribeResult>({ method: 'one-click-post', url: unsubUrl });
    }

    // Priority 2: Mailto unsubscribe — send an email via Gmail API
    if (mailtoMatch) {
      const mailto = mailtoMatch[1];
      const [to, qs] = mailto.split('?');
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

      return NextResponse.json<UnsubscribeResult>({ method: 'mailto', to });
    }

    // Priority 3: Return HTTPS link for user to open manually
    if (httpsMatch) {
      return NextResponse.json<UnsubscribeResult>({ method: 'link', url: httpsMatch[1] });
    }

    return NextResponse.json<UnsubscribeResult>({
      method: 'none',
      message: 'Could not parse a usable unsubscribe option from the header.',
    });
  } catch (err: any) {
    console.error('❌ Unsubscribe error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
