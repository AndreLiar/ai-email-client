import type { SenderRow } from '../types';
import styles from '../cleaner.module.css';

interface Props {
  label: string;
  senders: SenderRow[];
  emailCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ label, senders, emailCount, onConfirm, onCancel }: Props) {
  const hasTransactional = senders.some(s => !s.category || s.category === 'transactional');
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <p className={styles.modalTag}>// confirm_action</p>
        <h2 className={styles.modalTitle}>{label}</h2>
        <p className={styles.modalSub}>
          This will trash {emailCount.toLocaleString()} emails from{' '}
          {senders.length} sender{senders.length !== 1 ? 's' : ''}.
          Senders with auto-unsubscribe will be unsubscribed first.
        </p>
        {hasTransactional && (
          <div className={styles.modalWarning}>
            ⚠ Some senders may be transactional (receipts, banks, alerts). Review before confirming.
          </div>
        )}
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onCancel}>CANCEL</button>
          <button className={styles.modalConfirm} onClick={onConfirm}>CONFIRM DELETE</button>
        </div>
      </div>
    </div>
  );
}
