import { formatEmailAsMime } from '@/lib/formatEmailAsMime';
import type { GmailMessage, UnsubscribeResult } from '@/types/email';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

export async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 500,
  pageToken?: string
): Promise<{ messages: { id: string }[]; nextPageToken?: string }> {
  const params = new URLSearchParams({ maxResults: String(maxResults), q: query });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(`${GMAIL_API}/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

export async function getMessageMetadata(
  accessToken: string,
  messageId: string,
  metadataHeaders: string[]
): Promise<GmailMessage> {
  const headerParams = metadataHeaders.map(h => `metadataHeaders=${h}`).join('&');
  const res = await fetch(
    `${GMAIL_API}/users/me/messages/${messageId}?format=metadata&${headerParams}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    }
  );
  return res.json();
}

export async function batchTrash(accessToken: string, ids: string[]): Promise<void> {
  const CHUNK = 1000;
  for (let i = 0; i < ids.length; i += CHUNK) {
    await fetch(`${GMAIL_API}/users/me/messages/batchModify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: ids.slice(i, i + CHUNK),
        addLabelIds: ['TRASH'],
        removeLabelIds: ['INBOX', 'UNREAD'],
      }),
    });
  }
}

export async function sendMessage(accessToken: string, raw: string): Promise<void> {
  await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
}

export async function trashAllFromSender(
  accessToken: string,
  senderEmail: string,
  limit = 1000
): Promise<number> {
  let allIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const data = await listMessages(
      accessToken,
      `from:${senderEmail}`,
      500,
      pageToken
    );
    allIds = allIds.concat((data.messages || []).map(m => m.id));
    pageToken = data.nextPageToken;
  } while (pageToken && allIds.length < limit);

  if (allIds.length === 0) return 0;
  await batchTrash(accessToken, allIds);
  return allIds.length;
}

export async function performUnsubscribe(
  accessToken: string,
  messageId: string
): Promise<UnsubscribeResult> {
  const msg = await getMessageMetadata(accessToken, messageId, [
    'List-Unsubscribe',
    'List-Unsubscribe-Post',
  ]);
  const headers = msg.payload?.headers || [];

  const listUnsub = headers.find(h => h.name === 'List-Unsubscribe')?.value || '';
  const hasOneClickPost = !!headers.find(h => h.name === 'List-Unsubscribe-Post');

  if (!listUnsub) {
    return { method: 'none', message: 'No List-Unsubscribe header found on this email.' };
  }

  const mailtoMatch = listUnsub.match(/<mailto:([^>]+)>/i);
  const httpsMatch = listUnsub.match(/<(https?:\/\/[^>]+)>/i);

  if (httpsMatch && hasOneClickPost) {
    const unsubUrl = httpsMatch[1];
    await fetch(unsubUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    });
    return { method: 'one-click-post', url: unsubUrl };
  }

  if (mailtoMatch) {
    const [to, qs] = mailtoMatch[1].split('?');
    const subject = new URLSearchParams(qs || '').get('subject') || 'Unsubscribe';
    const raw = formatEmailAsMime(to, subject, 'Please remove me from this mailing list.');
    await sendMessage(accessToken, raw);
    return { method: 'mailto', to };
  }

  if (httpsMatch) {
    return { method: 'link', url: httpsMatch[1] };
  }

  return { method: 'none', message: 'Could not parse a usable unsubscribe option from the header.' };
}

export function parseFromHeader(fromHeader: string): { email: string; displayName: string } {
  const angleMatch = fromHeader.match(/<([^>]+@[^>]+)>/);
  const plainMatch = fromHeader.match(/([^\s]+@[^\s]+)/);
  const email = (angleMatch?.[1] || plainMatch?.[1] || fromHeader).toLowerCase().trim();
  const displayName = fromHeader.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || email;
  return { email, displayName };
}
