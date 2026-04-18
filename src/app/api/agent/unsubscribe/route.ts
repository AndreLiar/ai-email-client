import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getValidAccessToken } from '@/services/auth';
import { performUnsubscribe } from '@/services/gmail';
import type { UnsubscribeResult } from '@/types/email';

export type { UnsubscribeResult };

export async function POST(req: NextRequest) {
  const { messageId } = await req.json();
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });

  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const accessToken = await getValidAccessToken(userId);
    const result = await performUnsubscribe(accessToken, messageId);
    return NextResponse.json<UnsubscribeResult>(result);
  } catch (err: any) {
    console.error('❌ Unsubscribe error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
