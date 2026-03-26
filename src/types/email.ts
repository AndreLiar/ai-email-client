export interface SenderInfo {
  displayName: string;
  email: string;
  count: number;
  messageIds: string[];
  sampleMessageId: string;
  listUnsubscribe: string | null;
  listUnsubscribePost: boolean;
  canAutoUnsubscribe: boolean;
  oldestDate: number;
  newestDate: number;
}

export type UnsubscribeResult =
  | { method: 'one-click-post'; url: string }
  | { method: 'mailto'; to: string }
  | { method: 'link'; url: string }
  | { method: 'none'; message: string };

export interface GmailMessage {
  id: string;
  internalDate?: string;
  payload?: {
    headers: { name: string; value: string }[];
  };
}
