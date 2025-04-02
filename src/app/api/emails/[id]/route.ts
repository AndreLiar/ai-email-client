// src/app/api/emails/[id]/route.ts
import { auth } from '@clerk/nextjs/server';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const accessToken = await getValidAccessToken(userId);
    const id = context.params.id;

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const message = await res.json();

    const bodyData = message.payload?.parts?.[0]?.body?.data || '';
    const decodedBody = Buffer.from(bodyData, 'base64').toString('utf8');

    return NextResponse.json({
      id: message.id,
      subject: message.payload.headers.find((h: any) => h.name === 'Subject')?.value,
      from: message.payload.headers.find((h: any) => h.name === 'From')?.value,
      body: decodedBody,
    });
  } catch (err: any) {
    console.error('❌ Erreur chargement email :', err.message);
    return NextResponse.json({ error: 'Erreur lors du chargement de l’email' }, { status: 500 });
  }
}
