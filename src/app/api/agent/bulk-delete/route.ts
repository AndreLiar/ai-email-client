import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getValidAccessToken } from '@/services/auth';
import { trashAllFromSender } from '@/services/gmail';

export async function POST(req: NextRequest) {
  const { senderEmail } = await req.json();
  if (!senderEmail) return NextResponse.json({ error: 'senderEmail required' }, { status: 400 });

  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const accessToken = await getValidAccessToken(userId);
    const deleted = await trashAllFromSender(accessToken, senderEmail);
    return NextResponse.json({ deleted, senderEmail });
  } catch (err: any) {
    if (err?.message?.includes('RECONNECT_REQUIRED')) {
      return NextResponse.json({ error: 'Gmail not connected. Please reconnect.', reconnect: true }, { status: 403 });
    }
    console.error('❌ Bulk delete error:', err.message);
    return NextResponse.json({ error: 'Failed to delete emails' }, { status: 500 });
  }
}
