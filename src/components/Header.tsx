'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header() {
  const router = useRouter();

  async function handleDisconnect() {
    await fetch('/api/auth/disconnect', { method: 'POST' });
    router.push('/');
  }

  return (
    <div className="d-flex justify-content-between align-items-center bg-light p-3 border rounded mb-4">
      <div>
        <Link href="/cleaner" className="btn btn-outline-primary me-2">
          🧹 Inbox Cleaner
        </Link>
      </div>
      <div>
        <button onClick={handleDisconnect} className="btn btn-danger btn-sm">
          Disconnect Gmail
        </button>
      </div>
    </div>
  );
}
