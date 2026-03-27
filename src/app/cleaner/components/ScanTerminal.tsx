import { useRef, useEffect } from 'react';
import type { ScanLine } from '../types';
import styles from '../cleaner.module.css';

interface Props {
  scanLines: ScanLine[];
  scanning: boolean;
  classifying: boolean;
}

export default function ScanTerminal({ scanLines, scanning, classifying }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [scanLines]);

  if (scanLines.length === 0) return null;

  return (
    <div className={styles.scanTerminal}>
      <div className={styles.scanTermBar}>
        <div className={`${styles.dot} ${styles.dotR}`} />
        <div className={`${styles.dot} ${styles.dotY}`} />
        <div className={`${styles.dot} ${styles.dotG}`} />
        <span className={styles.scanTermTitle}>inbox-cleaner — scan</span>
      </div>
      <div className={styles.scanTermBody} ref={ref}>
        <div className={styles.termLine}>
          <span className={styles.termArrow}>$</span>
          <span className={styles.termInfo}>scan --unread --older_than=180d --entire_mailbox</span>
        </div>
        {scanLines.map((line, i) => (
          <div key={i} className={styles.termLine}>
            <span className={styles.termArrow}>↳</span>
            {line.type === 'progress' ? (
              <div className={styles.termProgressWrap}>
                <span className={styles.termProgressText}>{line.text}</span>
                <div className={styles.termBarTrack}>
                  <div className={styles.termBarFill} style={{ width: `${line.progress ?? 0}%` }} />
                </div>
              </div>
            ) : (
              <span className={
                line.type === 'success' ? styles.termSuccess :
                line.type === 'error'   ? styles.termError :
                styles.termInfo
              }>
                {line.text}
              </span>
            )}
          </div>
        ))}
        {classifying && (
          <div className={styles.termLine}>
            <span className={styles.termArrow}>↳</span>
            <span className={styles.termInfo}>Classifying senders with AI...</span>
          </div>
        )}
        {scanning && (
          <div className={styles.termLine}>
            <span className={styles.termArrow} style={{ opacity: 0 }}>↳</span>
            <span className={styles.termCursor} />
          </div>
        )}
      </div>
    </div>
  );
}
