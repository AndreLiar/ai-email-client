import type { SenderRow, ScanResult, SenderStatus } from '../types';
import { CATEGORY_COLORS, PAGE_SIZE, monthsAgo, formatDate } from '../utils';
import styles from '../cleaner.module.css';

interface Props {
  scanResult: ScanResult;
  pagedSenders: SenderRow[];
  selected: Set<string>;
  senderStatuses: Record<string, SenderStatus>;
  page: number;
  totalPages: number;
  doneCount: number;
  selectedCount: number;
  onToggleSelect: (email: string) => void;
  onToggleSelectAll: () => void;
  onTrash: (email: string) => void;
  onUnsubTrash: (sender: SenderRow) => void;
  onDeleteSelected: () => void;
  onUnsubscribeAndDeleteSelected: () => void;
  onPage: (p: number) => void;
}

export default function SenderTable({
  scanResult, pagedSenders, selected, senderStatuses,
  page, totalPages, doneCount, selectedCount,
  onToggleSelect, onToggleSelectAll, onTrash, onUnsubTrash,
  onDeleteSelected, onUnsubscribeAndDeleteSelected, onPage,
}: Props) {
  return (
    <>
      <div className={styles.scanBar}>
        <span className={styles.scanMeta}>
          <strong>{scanResult.senders.length}</strong> repetitive senders in{' '}
          <strong>{scanResult.total}</strong> unread emails older than 6 months
          {doneCount > 0 && <span className={styles.doneBadge}>✓ {doneCount} cleaned</span>}
        </span>
        <div className={styles.bulkActions}>
          <button
            className={styles.btnTrash}
            disabled={selectedCount === 0}
            onClick={onDeleteSelected}
          >
            TRASH ({selectedCount})
          </button>
          <button
            className={styles.btnUnsub}
            disabled={selectedCount === 0}
            onClick={onUnsubscribeAndDeleteSelected}
          >
            UNSUB + TRASH ({selectedCount})
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={scanResult.senders.length > 0 && selected.size === scanResult.senders.length}
                  onChange={onToggleSelectAll}
                />
              </th>
              <th>Sender</th>
              <th style={{ width: 80 }}>Unread</th>
              <th style={{ width: 100 }}>Engagement</th>
              <th style={{ width: 110 }}>Oldest</th>
              <th style={{ width: 130 }}>Category</th>
              <th style={{ width: 90 }}>Unsub</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedSenders.map(sender => {
              const st = senderStatuses[sender.email] || 'idle';
              const busy = st === 'deleting' || st === 'unsubscribing';
              const cat = sender.category;
              const catStyle = cat ? CATEGORY_COLORS[cat] : null;
              return (
                <tr key={sender.email} className={st === 'done' ? styles.rowDone : ''}>
                  <td>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selected.has(sender.email)}
                      onChange={() => onToggleSelect(sender.email)}
                      disabled={busy || st === 'done'}
                    />
                  </td>
                  <td>
                    <div className={styles.senderName}>{sender.displayName}</div>
                    <div className={styles.senderEmail}>{sender.email}</div>
                  </td>
                  <td>
                    <span className={styles.countBadge}>{sender.count}</span>
                  </td>
                  <td>
                    <div className={styles.engageCell}>
                      <span className={styles.engageZero}>0 / {sender.count} opened</span>
                      <span className={styles.engageSub}>0% engagement</span>
                    </div>
                  </td>
                  <td>
                    {sender.oldestDate ? (
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{
                          fontFamily: 'var(--font-space-mono)', fontSize: '0.62rem',
                          color: monthsAgo(sender.oldestDate) >= 12 ? '#ff5f57' : '#ffbd2e',
                          letterSpacing: '0.04em',
                        }}>
                          {monthsAgo(sender.oldestDate)}mo ago
                        </span>
                        <span style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.58rem', color: '#2a4a34' }}>
                          {formatDate(sender.oldestDate)}
                        </span>
                      </span>
                    ) : (
                      <span className={styles.statusIdle}>—</span>
                    )}
                  </td>
                  <td>
                    {catStyle ? (
                      <span
                        className={styles.catBadge}
                        style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.color}40` }}
                      >
                        {cat}
                      </span>
                    ) : (
                      <span className={styles.statusIdle}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={sender.canAutoUnsubscribe ? styles.unsubAuto : styles.unsubManual}>
                      {sender.canAutoUnsubscribe ? 'AUTO' : 'MANUAL'}
                    </span>
                  </td>
                  <td>
                    {st === 'idle' && <span className={styles.statusIdle}>—</span>}
                    {(st === 'unsubscribing' || st === 'deleting') && (
                      <span className={styles.statusWorking}>
                        <div className={styles.thinkingDot} />
                        <div className={styles.thinkingDot} />
                        <div className={styles.thinkingDot} />
                        {st === 'unsubscribing' ? 'UNSUB' : 'TRASH'}
                      </span>
                    )}
                    {st === 'done' && <span className={styles.statusDone}>✓ DONE</span>}
                    {st === 'error' && <span className={styles.statusError}>✕ ERROR</span>}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        className={`${styles.actBtn} ${styles.actTrash}`}
                        disabled={busy || st === 'done'}
                        onClick={() => onTrash(sender.email)}
                        title="Move all emails to Trash"
                      >
                        TRASH
                      </button>
                      <button
                        className={`${styles.actBtn} ${styles.actUnsub}`}
                        disabled={busy || st === 'done'}
                        onClick={() => onUnsubTrash(sender)}
                        title="Unsubscribe then Trash"
                      >
                        +UNSUB
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.pageInfo}>
              SHOWING {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, scanResult.senders.length)} OF {scanResult.senders.length} SENDERS
            </span>
            <div className={styles.pageBtns}>
              <button className={styles.pageBtn} disabled={page === 0} onClick={() => onPage(page - 1)}>
                ← PREV
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  className={`${styles.pageBtn} ${page === i ? styles.pageBtnActive : ''}`}
                  onClick={() => onPage(i)}
                >
                  {i + 1}
                </button>
              ))}
              <button className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>
                NEXT →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
