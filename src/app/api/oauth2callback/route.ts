import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeCodeForTokens } from '@/services/auth';
import { saveGmailTokens } from '@/services/storage';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  const code = new URL(req.url).searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/cleaner?error=no_code', req.url));
  }

  const tokens = await exchangeCodeForTokens(code);

  if (!tokens.access_token) {
    console.error('Failed to get Gmail token:', tokens);
    return NextResponse.redirect(new URL('/cleaner?error=gmail_token', req.url));
  }

  await saveGmailTokens(userId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    updatedAt: Date.now(),
  });

  console.log('Gmail tokens stored for Clerk user.');
  return NextResponse.redirect(new URL('/cleaner', req.url));
}
