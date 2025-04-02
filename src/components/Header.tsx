//src/components/Header.tsx
'use client';

import { SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Header() {
  return (
    <div className="d-flex justify-content-between align-items-center bg-light p-3 border rounded mb-4">
      <div>
        <Link href="/emails" className="btn btn-outline-primary me-2">
          📥 Emails
        </Link>
        <Link href="/dashboard" className="btn btn-outline-secondary">
          👤 Dashboard
        </Link>
        <Link href="/history" className="btn btn-outline-warning me-2">
  🧠 Historique
</Link>

      </div>

      <div className="d-flex align-items-center gap-3">
        <UserButton />
        <SignOutButton>
          <button className="btn btn-danger">Se déconnecter</button>
        </SignOutButton>
      </div>
    </div>
  );
}
