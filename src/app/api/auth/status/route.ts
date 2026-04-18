import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isGmailConnected } from '@/services/auth';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ connected: false });
  const connected = await isGmailConnected(userId);
  return NextResponse.json({ connected });
}
