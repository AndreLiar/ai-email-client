// app/api/oauth2callback/route.ts
import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code || '',
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await res.json();

  if (!tokens.access_token) {
    console.error("❌ Erreur lors de l'obtention du token Gmail", tokens);
    return NextResponse.redirect(new URL('/emails?error=gmail_token', req.url));
  }

  console.log('✅ Tokens reçus de Gmail OAuth:', tokens);

  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, {
    privateMetadata: {
      gmailAccessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    },
  });
  

  console.log("🔐 Gmail access token stocké pour l'utilisateur:", userId);

  return NextResponse.redirect(new URL('/emails', req.url));
}
