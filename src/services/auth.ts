import { getGmailTokens, saveGmailTokens } from '@/services/storage';

export const COOKIE_ACCESS = 'gmail_access_token';
export const COOKIE_REFRESH = 'gmail_refresh_token';

interface GmailProfileResponse {
  emailAddress?: string;
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const tokenRecord = await getGmailTokens(userId);
  let accessToken = tokenRecord?.accessToken;
  const refreshToken = tokenRecord?.refreshToken;

  if (!accessToken) throw new Error('RECONNECT_REQUIRED: Gmail not connected');

  const testRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (testRes.status !== 401) return accessToken;

  if (!refreshToken) throw new Error('RECONNECT_REQUIRED: Gmail token expired. Please reconnect your Gmail account.');

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
  if (!newTokens.access_token) throw new Error('RECONNECT_REQUIRED: Failed to refresh Gmail token. Please reconnect your Gmail account.');

  await saveGmailTokens(userId, {
    accessToken: newTokens.access_token,
    refreshToken: refreshToken,
    updatedAt: Date.now(),
  });

  console.log('Gmail access token refreshed successfully.');
  return newTokens.access_token as string;
}

export async function isGmailConnected(userId: string): Promise<boolean> {
  const tokenRecord = await getGmailTokens(userId);
  return !!tokenRecord?.accessToken;
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

export async function getGmailUserId(accessToken: string): Promise<string> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Gmail profile.');

  const profile = await res.json() as GmailProfileResponse;
  const email = profile.emailAddress?.trim().toLowerCase();
  if (!email) throw new Error('Failed to resolve Gmail user identity.');
  return email;
}
