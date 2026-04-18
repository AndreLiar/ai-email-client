import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isGmailConnected } from '@/services/auth';
import { isUserSubscribed } from '@/services/subscription';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ connected: false, subscribed: false });
    const [connected, subscribed] = await Promise.all([
      isGmailConnected(userId),
      isUserSubscribed(userId),
    ]);
    return NextResponse.json({ connected, subscribed });
  } catch {
    return NextResponse.json({ connected: false, subscribed: false });
  }
}
