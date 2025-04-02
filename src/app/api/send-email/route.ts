// app/api/send-email/route.ts
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { formatEmailAsMime } from '@/lib/formatEmailAsMime';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = user.privateMetadata?.gmailAccessToken as string;

  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail non connecté' }, { status: 403 });
  }

  const { to, subject, body } = await req.json();
  const raw = formatEmailAsMime(to, subject, body);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('❌ Erreur Gmail API:', data);
    return NextResponse.json({ error: 'Erreur envoi Gmail', details: data }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
