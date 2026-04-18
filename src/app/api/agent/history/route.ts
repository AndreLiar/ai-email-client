import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDecisionExecutionsForUser } from '@/services/storage';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const records = await getDecisionExecutionsForUser(userId);
    return NextResponse.json({ records });
  } catch (err: any) {
    if (err?.message?.includes('Gmail not connected')) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 403 });
    }

    console.error('[history] error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
