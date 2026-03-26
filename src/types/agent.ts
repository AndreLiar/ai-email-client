import type { SenderInfo } from './email';

export interface ScanResult {
  senders: SenderInfo[];
  total: number;
}

export interface ClassifiedSender {
  email: string;
  category: 'newsletter' | 'job_alert' | 'promo' | 'social' | 'transactional' | 'other';
}

export interface AgentAction {
  type: 'trash' | 'unsubscribe' | 'classify';
  senderEmail: string;
  count?: number;
  timestamp: number;
}
