import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clearGmailTokens } from '@/services/storage';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: true });
  await clearGmailTokens(userId);
  return NextResponse.json({ ok: true });
}
