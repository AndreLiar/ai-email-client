// app/api/oauth2callback/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/cleaner?error=no_code', req.url));
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await res.json();

  if (!tokens.access_token) {
    console.error('Failed to get Gmail token:', tokens);
    return NextResponse.redirect(new URL('/cleaner?error=gmail_token', req.url));
  }

  const response = NextResponse.redirect(new URL('/cleaner', req.url));

  // Store tokens in HTTP-only cookies (secure, not accessible via JS)
  response.cookies.set('gmail_access_token', tokens.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  if (tokens.refresh_token) {
    response.cookies.set('gmail_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
  }

  console.log('Gmail tokens stored in cookies.');
  return response;
}
