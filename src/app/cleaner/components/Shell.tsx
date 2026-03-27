import Link from 'next/link';
import styles from '../cleaner.module.css';

interface ShellProps {
  children: React.ReactNode;
  onDisconnect: () => void;
}

export default function Shell({ children, onDisconnect }: ShellProps) {
  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          clean<span>inbox</span>.ai
        </Link>
        <div className={styles.navActions}>
          <button className={styles.btnGhost} onClick={onDisconnect}>
            DISCONNECT GMAIL
          </button>
        </div>
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
