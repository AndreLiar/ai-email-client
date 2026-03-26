import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/services/auth';
import { trashAllFromSender } from '@/services/gmail';

export async function POST(req: NextRequest) {
  const { senderEmail } = await req.json();
  if (!senderEmail) return NextResponse.json({ error: 'senderEmail required' }, { status: 400 });

  try {
    const accessToken = await getValidAccessToken();
    const deleted = await trashAllFromSender(accessToken, senderEmail);
    return NextResponse.json({ deleted, senderEmail });
  } catch (err: any) {
    console.error('❌ Bulk delete error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
