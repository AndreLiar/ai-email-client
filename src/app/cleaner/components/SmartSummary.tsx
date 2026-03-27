import type { SenderRow } from '../types';
import { CATEGORY_COLORS } from '../utils';
import styles from '../cleaner.module.css';

interface CategoryGroup {
  cat: string;
  sds: SenderRow[];
  total: number;
}

interface SmartSummaryData {
  total: number;
  cleanable: number;
  topCat: CategoryGroup;
  autoCount: number;
  groups: CategoryGroup[];
}

interface Props {
  summary: SmartSummaryData;
  onDismiss: () => void;
}

export default function SmartSummary({ summary, onDismiss }: Props) {
  return (
    <div className={styles.summary}>
      <div className={styles.summaryBar}>
        <span className={styles.summaryTag}>// smart_summary</span>
        <button className={styles.summaryDismiss} onClick={onDismiss}>DISMISS ×</button>
      </div>
      <div className={styles.summaryBody}>
        <div>
          <p className={styles.summaryHeadline}>
            <em>{summary.cleanable.toLocaleString()}</em> emails you can safely delete
          </p>
          <p className={styles.summarySub}>
            {summary.groups.length} categories identified across{' '}
            <strong>{summary.total.toLocaleString()}</strong> classified emails —
            <strong> {summary.cleanable.toLocaleString()}</strong> are safe to delete
            (everything except transactional).<br /><br />
            Start with{' '}
            <strong style={{ color: CATEGORY_COLORS[summary.topCat.cat]?.color ?? '#c8d8cc' }}>
              {summary.topCat.cat}
            </strong>{' '}
            — {summary.topCat.total.toLocaleString()} emails from {summary.topCat.sds.length} sender
            {summary.topCat.sds.length !== 1 ? 's' : ''} you've never opened.
            Use the <strong>{summary.topCat.cat.toUpperCase()}</strong> button below to clean all of them in one shot.
            {summary.autoCount > 0 && (
              <><br /><br />Then hit ⚡ <strong>UNSUB ALL AUTO</strong> to unsubscribe from {summary.autoCount} sender
              {summary.autoCount !== 1 ? 's' : ''} — they'll stop emailing you permanently.</>
            )}
          </p>
        </div>
        <div>
          <div className={styles.summaryCatList}>
            {summary.groups.map(({ cat, total, sds }) => {
              const style = CATEGORY_COLORS[cat] ?? { bg: 'rgba(120,120,140,0.15)', color: '#888899' };
              const pct = summary.total > 0 ? Math.round((total / summary.total) * 100) : 0;
              return (
                <div key={cat} className={styles.summaryCatRow}>
                  <span className={styles.summaryCatName} style={{ color: style.color }}>{cat}</span>
                  <div className={styles.summaryTrack}>
                    <div className={styles.summaryFill} style={{ width: `${pct}%`, background: style.color }} />
                  </div>
                  <span className={styles.summaryCatCount}>{total.toLocaleString()} ({sds.length})</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
