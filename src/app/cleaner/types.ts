export type SenderRow = {
  displayName: string;
  email: string;
  count: number;
  sampleMessageId: string;
  canAutoUnsubscribe: boolean;
  category?: string;
  oldestDate: number;
  newestDate: number;
};

export type ScanResult = {
  senders: SenderRow[];
  total: number;
};

export type SenderStatus = 'idle' | 'deleting' | 'unsubscribing' | 'done' | 'error';

export type ScanLine = {
  text: string;
  type: 'info' | 'progress' | 'success' | 'error';
  progress?: number;
};
