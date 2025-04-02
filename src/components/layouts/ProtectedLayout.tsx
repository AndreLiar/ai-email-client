//src/components/layouts/ProtectedLayout.tsx
'use client';

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "../Header";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isSignedIn) {
    return null; // ⏳ Affiche rien pendant le redirect
  }

  return (
    <div className="container py-4">
      <Header />
      {children}
    </div>
  );
}
