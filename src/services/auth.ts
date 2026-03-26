import { cookies } from 'next/headers';

export const COOKIE_ACCESS = 'gmail_access_token';
export const COOKIE_REFRESH = 'gmail_refresh_token';

export async function getValidAccessToken(): Promise<string> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(COOKIE_ACCESS)?.value;
  const refreshToken = cookieStore.get(COOKIE_REFRESH)?.value;

  if (!accessToken) throw new Error('Gmail not connected');

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
  if (!newTokens.access_token) throw new Error('Failed to refresh Gmail token. Please reconnect.');

  console.log('Gmail access token refreshed successfully.');
  return newTokens.access_token;
}

export async function isGmailConnected(): Promise<boolean> {
  const cookieStore = await cookies();
  return !!cookieStore.get(COOKIE_ACCESS)?.value;
}

export function buildGmailAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<{ access_token: string; refresh_token?: string }> {
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
  return res.json();
}
