import type { ScanResult } from '../types';
import { monthsAgo, formatDate } from '../utils';
import styles from '../cleaner.module.css';

interface Analytics {
  totalEmails: number;
  autoUnsub: number;
  highPriority: number;
  oldest: number;
  buckets: { recent: number; old: number; veryOld: number };
}

interface Props {
  scanResult: ScanResult;
  analytics: Analytics;
}

export default function AnalyticsReport({ scanResult, analytics }: Props) {
  return (
    <div className={styles.report}>
      <div className={styles.reportBar}>
        <span className={styles.reportTag}>// scan_report</span>
        <span className={styles.reportMeta}>UNREAD · OLDER THAN 6 MONTHS · REPETITIVE SENDERS</span>
      </div>
      <div className={styles.reportBody}>
        <div className={styles.statGrid}>
          <div className={styles.statCell}>
            <span className={styles.statVal}>{scanResult.total.toLocaleString()}</span>
            <span className={styles.statLbl}>Stale Emails Found</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statVal}>{scanResult.senders.length}</span>
            <span className={styles.statLbl}>Repetitive Senders</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statVal}>{analytics.autoUnsub}</span>
            <span className={styles.statLbl}>Auto-Unsubscribable</span>
          </div>
          <div className={styles.statCell}>
            <span
              className={styles.statVal}
              style={{ color: monthsAgo(analytics.oldest) >= 24 ? '#ff5f57' : '#ffbd2e' }}
            >
              {monthsAgo(analytics.oldest)}mo
            </span>
            <span className={styles.statLbl}>Oldest Unread Email</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <p className={styles.ageLabel}>// insights</p>
            <div className={styles.insights}>
              {analytics.highPriority > 0 && (
                <div className={`${styles.insight} ${styles.insightRed}`}>
                  <span className={styles.insightIcon}>🔴</span>
                  <span className={styles.insightText}>
                    <strong>{analytics.highPriority} sender{analytics.highPriority > 1 ? 's' : ''}</strong> sent you 10+ emails you never opened — high priority to clean.
                  </span>
                </div>
              )}
              <div className={`${styles.insight} ${styles.insightGreen}`}>
                <span className={styles.insightIcon}>⚡</span>
                <span className={styles.insightText}>
                  <strong>{analytics.autoUnsub} sender{analytics.autoUnsub !== 1 ? 's' : ''}</strong> support one-click unsubscribe — no manual action needed.
                </span>
              </div>
              <div className={`${styles.insight} ${styles.insightYellow}`}>
                <span className={styles.insightIcon}>🗓️</span>
                <span className={styles.insightText}>
                  Your oldest unread email is <strong>{monthsAgo(analytics.oldest)} months old</strong> (since {formatDate(analytics.oldest)}) — you clearly don't need it.
                </span>
              </div>
              <div className={`${styles.insight} ${styles.insightDim}`}>
                <span className={styles.insightIcon}>🗑️</span>
                <span className={styles.insightText}>
                  Cleaning everything would remove <strong>{analytics.totalEmails.toLocaleString()} emails</strong> from your mailbox in one shot.
                </span>
              </div>
            </div>
          </div>

          <div>
            <p className={styles.ageLabel}>// age breakdown (by sender)</p>
            <div className={styles.ageBar}>
              {[
                { label: '6–12 months', count: analytics.buckets.recent,  color: '#ffbd2e' },
                { label: '1–2 years',   count: analytics.buckets.old,     color: '#ff8c57' },
                { label: '2+ years',    count: analytics.buckets.veryOld, color: '#ff5f57' },
              ].map(({ label, count, color }) => (
                <div key={label} className={styles.ageRow}>
                  <span className={styles.ageName}>{label}</span>
                  <div className={styles.ageTrack}>
                    <div
                      className={styles.ageFill}
                      style={{
                        width: scanResult.senders.length > 0
                          ? `${Math.round((count / scanResult.senders.length) * 100)}%`
                          : '0%',
                        background: color,
                      }}
                    />
                  </div>
                  <span className={styles.ageCount}>{count}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <p className={styles.ageLabel}>// recommendation</p>
              <p className={styles.recoText}>
                {analytics.buckets.veryOld > 0 && (
                  <>Start with the <span style={{ color: '#ff5f57' }}>{analytics.buckets.veryOld} senders</span> from 2+ years ago — you've had 2 years to read them.<br /></>
                )}
                {analytics.autoUnsub > 0 && (
                  <>Use <span style={{ color: '#00d97e' }}>UNSUB + TRASH</span> on the {analytics.autoUnsub} auto-unsubscribable senders to prevent future emails.<br /></>
                )}
                Select all and bulk-clean in one click if unsure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
