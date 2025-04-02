//src/lib/getValidAccessToken.ts
import { clerkClient } from '@clerk/nextjs/server';

export async function getValidAccessToken(userId: string): Promise<string> {
  // Get the Clerk client once
  const clerk = await clerkClient();
  
  const user = await clerk.users.getUser(userId);
  const metadata = user.privateMetadata;
  let accessToken = metadata?.gmailAccessToken as string;
  const refreshToken = metadata?.refreshToken as string;

  if (!accessToken) throw new Error('Aucun accessToken Gmail trouvé.');

  const testRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (testRes.status !== 401) {
    return accessToken;
  }

  if (!refreshToken) throw new Error('Aucun refreshToken disponible pour rafraîchissement.');

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
    console.error('❌ Échec du refresh Gmail:', newTokens);
    throw new Error('Impossible de rafraîchir le token Gmail.');
  }

  // Use the same clerk instance to update user metadata
  await clerk.users.updateUserMetadata(userId, {
    privateMetadata: {
      gmailAccessToken: newTokens.access_token,
      expiresIn: newTokens.expires_in,
    },
  });

  console.log('🔁 Nouveau access_token Gmail rafraîchi avec succès.');
  return newTokens.access_token;
}