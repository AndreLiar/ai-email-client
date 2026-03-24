'use client';

import Header from "../Header";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container py-4">
      <Header />
      {children}
    </div>
  );
}
