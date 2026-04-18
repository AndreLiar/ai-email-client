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

export type DecisionAction = 'delete' | 'archive' | 'keep' | 'reply';

export interface ReplyDraft {
  subject: string;
  body: string;
}

export interface EmailDecision {
  messageId: string;
  threadId?: string;
  action: DecisionAction;
  confidence: number;
  reason: string;
  replyDraft?: ReplyDraft;
}

export interface DecisionSummary {
  delete: number;
  archive: number;
  keep: number;
  reply: number;
}

export interface DecisionGroups {
  delete: EmailDecision[];
  archive: EmailDecision[];
  keep: EmailDecision[];
  reply: EmailDecision[];
}

export interface LowConfidenceDecision extends EmailDecision {
  threshold: number;
}

export interface DecisionScoring {
  byAction: DecisionGroups;
  sortedByConfidence: EmailDecision[];
  lowConfidence: LowConfidenceDecision[];
}

export interface DecisionBatch {
  query: string;
  scanned: number;
  dropped: number;
  droppedReasons?: string[];
  decisions: EmailDecision[];
  summary: DecisionSummary;
  scoring: DecisionScoring;
}
