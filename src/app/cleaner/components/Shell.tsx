'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../cleaner.module.css';

interface ShellProps {
  children: React.ReactNode;
  onDisconnect: () => void;
  gmailConnected?: boolean;
}

export default function Shell({ children, onDisconnect, gmailConnected }: ShellProps) {
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          get<span>cleaninbox</span>.xyz
        </Link>
        <div className={styles.navActions}>
          {gmailConnected && (
            confirmingDisconnect ? (
              <>
                <span style={{ fontSize: 13, opacity: 0.85 }}>Disconnect Gmail?</span>
                <button className={styles.btnGhost} onClick={() => { setConfirmingDisconnect(false); onDisconnect(); }}>
                  YES
                </button>
                <button className={styles.btnGhost} onClick={() => setConfirmingDisconnect(false)}>
                  CANCEL
                </button>
              </>
            ) : (
              <button className={styles.btnGhost} onClick={() => setConfirmingDisconnect(true)}>
                DISCONNECT GMAIL
              </button>
            )
          )}
        </div>
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
