import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildGmailAuthUrl, generatePkce } from '@/services/auth';
import { randomBytes } from 'crypto';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect('/sign-in');

  const state = randomBytes(16).toString('hex');
  const { verifier, challenge } = await generatePkce();
  const url = buildGmailAuthUrl(state, challenge);

  const res = NextResponse.redirect(url);
  res.cookies.set('gmail_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  });
  res.cookies.set('gmail_pkce_verifier', verifier, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  });
  return res;
}
