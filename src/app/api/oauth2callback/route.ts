import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, COOKIE_ACCESS, COOKIE_REFRESH } from '@/services/auth';

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/cleaner?error=no_code', req.url));
  }

  const tokens = await exchangeCodeForTokens(code);

  if (!tokens.access_token) {
    console.error('Failed to get Gmail token:', tokens);
    return NextResponse.redirect(new URL('/cleaner?error=gmail_token', req.url));
  }

  const response = NextResponse.redirect(new URL('/cleaner', req.url));

  response.cookies.set(COOKIE_ACCESS, tokens.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  if (tokens.refresh_token) {
    response.cookies.set(COOKIE_REFRESH, tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  console.log('Gmail tokens stored in cookies.');
  return response;
}
