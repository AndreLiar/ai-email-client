import type { SenderRow } from '../types';
import { CATEGORY_COLORS } from '../utils';
import styles from '../cleaner.module.css';

interface CategoryGroup {
  cat: string;
  sds: SenderRow[];
  total: number;
}

interface Props {
  categoryGroups: CategoryGroup[];
  bulkActive: boolean;
  classifying: boolean;
  autoCount: number;
  onCategoryClick: (label: string, senders: SenderRow[], emailCount: number) => void;
  onUnsubQueue: () => void;
}

export default function CategoryBulkActions({
  categoryGroups, bulkActive, classifying, autoCount, onCategoryClick, onUnsubQueue,
}: Props) {
  if (categoryGroups.length === 0) return null;

  return (
    <div className={styles.catActions}>
      <p className={styles.catActionsHeader}>// clean by category</p>
      <div className={styles.catChips}>
        {autoCount > 0 && (
          <button
            className={styles.unsubChip}
            onClick={onUnsubQueue}
            disabled={bulkActive}
          >
            ⚡ UNSUB ALL AUTO
            <span className={styles.catChipCount}>({autoCount})</span>
          </button>
        )}
        {categoryGroups.map(({ cat, sds, total }) => {
          const style = CATEGORY_COLORS[cat] ?? { bg: 'rgba(120,120,140,0.15)', color: '#888899' };
          return (
            <button
              key={cat}
              className={styles.catChip}
              style={{ borderColor: `${style.color}60`, color: style.color, background: style.bg }}
              disabled={bulkActive || classifying}
              onClick={() => onCategoryClick(
                `DELETE ALL ${cat.toUpperCase()} (${sds.length} senders)`,
                sds,
                total,
              )}
            >
              {cat}
              <span className={styles.catChipCount}>{sds.length} senders · {total.toLocaleString()} emails</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
