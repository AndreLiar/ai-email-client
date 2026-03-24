// src/app/api/agent/bulk-delete/route.ts
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { NextRequest, NextResponse } from 'next/server';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

export async function POST(req: NextRequest) {
  const { senderEmail } = await req.json();
  if (!senderEmail) return NextResponse.json({ error: 'senderEmail required' }, { status: 400 });

  try {
    const accessToken = await getValidAccessToken();

    // Collect all message IDs from this sender (paginated, up to 1000)
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

    if (allIds.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    // batchModify in chunks of 1000 — moves to Trash (reversible)
    const CHUNK = 1000;
    const chunks: string[][] = [];
    for (let i = 0; i < allIds.length; i += CHUNK) {
      chunks.push(allIds.slice(i, i + CHUNK));
    }

    await Promise.all(
      chunks.map(ids =>
        fetch(`${GMAIL_API}/users/me/messages/batchModify`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ids,
            addLabelIds: ['TRASH'],
            removeLabelIds: ['INBOX', 'UNREAD'],
          }),
        })
      )
    );

    return NextResponse.json({ deleted: allIds.length, senderEmail });
  } catch (err: any) {
    console.error('❌ Bulk delete error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
