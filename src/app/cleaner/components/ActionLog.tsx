import styles from '../cleaner.module.css';

interface Props {
  entries: string[];
}

export default function ActionLog({ entries }: Props) {
  if (entries.length === 0) return null;
  return (
    <div className={styles.logSection}>
      <p className={styles.logHeader}>// action_log</p>
      <div className={styles.logBody}>
        {entries.map((line, i) => (
          <div key={i} className={styles.logLine}>{line}</div>
        ))}
      </div>
    </div>
  );
}
