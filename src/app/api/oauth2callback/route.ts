import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeCodeForTokens } from '@/services/auth';
import { saveGmailTokens } from '@/services/storage';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  const searchParams = new URL(req.url).searchParams;
  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
  const storedState = req.cookies.get('gmail_oauth_state')?.value;

  if (!code) {
    return NextResponse.redirect(new URL('/cleaner?error=no_code', req.url));
  }

  if (!storedState || returnedState !== storedState) {
    return NextResponse.redirect(new URL('/cleaner?error=invalid_state', req.url));
  }

  const codeVerifier = req.cookies.get('gmail_pkce_verifier')?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/cleaner?error=missing_verifier', req.url));
  }

  const tokens = await exchangeCodeForTokens(code, codeVerifier);

  if (!tokens.access_token) {
    console.error('Failed to get Gmail token - full response:', JSON.stringify(tokens));
    console.error('redirect_uri used:', process.env.GOOGLE_REDIRECT_URI);
    const errMsg = (tokens as { error?: string }).error ?? 'unknown';
    return NextResponse.redirect(new URL(`/cleaner?error=gmail_token&detail=${errMsg}`, req.url));
  }

  await saveGmailTokens(userId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    updatedAt: Date.now(),
  });

  console.log('Gmail tokens stored for Clerk user.');
  const redirect = NextResponse.redirect(new URL('/cleaner', req.url));
  redirect.cookies.delete('gmail_oauth_state');
  redirect.cookies.delete('gmail_pkce_verifier');
  return redirect;
}
