import styles from '../cleaner.module.css';

interface Props {
  label: string;
  done: number;
  total: number;
}

export default function BulkProgress({ label, done, total }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={styles.bulkProgress}>
      <div className={styles.bulkProgressLabel}>
        <span>{label}</span>
        <span className={styles.bulkProgressCount}>{done} / {total} senders</span>
      </div>
      <div className={styles.bulkTrack}>
        <div className={styles.bulkFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
