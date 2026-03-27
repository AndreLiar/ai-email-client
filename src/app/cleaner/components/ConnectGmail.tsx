import styles from '../cleaner.module.css';

export default function ConnectGmail() {
  return (
    <div className={styles.connectWrap}>
      <div className={styles.connectCard}>
        <div className={styles.connectIcon}>📬</div>
        <p className={styles.connectTag}>// gmail_oauth</p>
        <h2 className={styles.connectH}>Connect your Gmail</h2>
        <p className={styles.connectSub}>
          Grant the agent read and modify access to scan senders,
          unsubscribe from lists, and bulk-delete emails.
        </p>
        <a href="/api/auth/gmail-connect" className={styles.connectBtn}>
          CONNECT GMAIL →
        </a>
        <div className={styles.perms}>
          <span className={styles.permItem}>Read and modify emails</span>
          <span className={styles.permItem}>Send unsubscribe requests</span>
          <span className={styles.permItem}>Tokens stored in HTTP-only cookies</span>
        </div>
      </div>
    </div>
  );
}
