import type { SenderRow } from './types';

export const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  newsletter:    { bg: 'rgba(0,217,126,0.15)',   color: '#00d97e' },
  job_alert:     { bg: 'rgba(255,189,46,0.15)',  color: '#ffbd2e' },
  promo:         { bg: 'rgba(255,95,87,0.15)',   color: '#ff5f57' },
  social:        { bg: 'rgba(90,130,255,0.15)',  color: '#7a9aff' },
  transactional: { bg: 'rgba(0,200,180,0.15)',   color: '#00c8b4' },
  other:         { bg: 'rgba(120,120,140,0.15)', color: '#888899' },
};

export const PAGE_SIZE = 20;

export function monthsAgo(ts: number): number {
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24 * 30));
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Cleanup urgency: heavier volume + older = higher score */
export function priorityScore(s: SenderRow): number {
  return s.count * 2 + Math.min(Math.floor(monthsAgo(s.oldestDate) / 3), 20);
}
