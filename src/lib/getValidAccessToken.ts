// src/lib/getValidAccessToken.ts
import { cookies } from 'next/headers';

export async function getValidAccessToken(): Promise<string> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get('gmail_access_token')?.value;
  const refreshToken = cookieStore.get('gmail_refresh_token')?.value;

  if (!accessToken) throw new Error('Gmail not connected');

  // Test if token is still valid
  const testRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (testRes.status !== 401) return accessToken;

  if (!refreshToken) throw new Error('Gmail token expired. Please reconnect.');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const newTokens = await tokenRes.json();

  if (!newTokens.access_token) {
    throw new Error('Failed to refresh Gmail token. Please reconnect.');
  }

  // Note: can't set cookies from server actions directly — token will be refreshed next request
  console.log('Gmail access token refreshed successfully.');
  return newTokens.access_token;
}
