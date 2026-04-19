import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildGmailAuthUrl } from '@/services/auth';
import { randomBytes } from 'crypto';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect('/sign-in');

  const state = randomBytes(16).toString('hex');
  const url = buildGmailAuthUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
