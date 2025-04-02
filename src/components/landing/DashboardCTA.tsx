// src/components/landing/DashboardCTA.tsx
'use client';
import { SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { motion } from "framer-motion";

export default function DashboardCTA() {
  return (
    <SignedIn>
      <section className="py-5 bg-light">
        <div className="container text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="fw-bold mb-4">Bienvenue dans votre espace</h2>
            <p className="lead mb-4">
              Prêt à booster votre productivité email ? Choisissez une option ci-dessous.
            </p>

            <div className="d-flex justify-content-center flex-wrap gap-3">
              <Link href="/emails" className="btn btn-primary btn-lg px-4">📥 Boîte de réception</Link>
              <Link href="/dashboard" className="btn btn-success btn-lg px-4">📊 Tableau de bord</Link>
              <Link href="/history" className="btn btn-warning btn-lg px-4">🧠 Historique</Link>
            </div>

            <div className="mt-4">
              <UserButton afterSignOutUrl="/" />
              <div className="mt-2 small text-muted">
                Connecté avec votre compte Gmail
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </SignedIn>
  );
}
