// src/app/api/emails/route.ts
import { auth } from '@clerk/nextjs/server';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { NextResponse } from 'next/server';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const accessToken = await getValidAccessToken(userId);

    const messagesListRes = await fetch(`${GMAIL_API_BASE}/users/me/messages?maxResults=10`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const messagesList = await messagesListRes.json();

    if (!messagesList.messages) {
      return NextResponse.json([]);
    }

    const emails = await Promise.all(
      messagesList.messages.map(async (msg: any) => {
        const messageRes = await fetch(
          `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        const message = await messageRes.json();
        const headers = message.payload.headers;

        return {
          id: msg.id,
          subject: headers.find((h: any) => h.name === 'Subject')?.value || '(Sans sujet)',
          from: headers.find((h: any) => h.name === 'From')?.value || 'Inconnu',
          snippet: message.snippet,
        };
      })
    );

    return NextResponse.json(emails);
  } catch (err: any) {
    console.error('❌ Erreur chargement Gmail:', err.message);
    return NextResponse.json({ error: 'Erreur lors du chargement des emails' }, { status: 500 });
  }
}
