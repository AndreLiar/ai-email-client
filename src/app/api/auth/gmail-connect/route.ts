import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildGmailAuthUrl } from '@/services/auth';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect('/sign-in');
  return NextResponse.redirect(buildGmailAuthUrl());
}
