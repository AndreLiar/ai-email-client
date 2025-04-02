// src/components/landing/HeroSection.tsx
'use client';
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";

export default function HeroSection() {
  return (
    <section className="py-5 bg-light">
      <div className="container py-5">
        <div className="row align-items-center">
          <div className="col-lg-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="display-4 fw-bold mb-4">
                Transformez votre <span className="text-primary">boîte mail</span> avec l'IA
              </h1>
              <p className="lead mb-4">
                Gérez vos emails Gmail en un clin d'œil grâce à la puissance de Gemini AI.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="btn btn-primary btn-lg px-4">Essai gratuit 🚀</button>
                  </SignInButton>
                  <Link href="/demo" className="btn btn-outline-primary btn-lg px-4">Voir la démo</Link>
                </SignedOut>
                <SignedIn>
                  <Link href="/emails" className="btn btn-primary btn-lg px-4">Accéder à mes emails</Link>
                </SignedIn>
              </div>
              <div className="mt-3 small text-muted">
                Aucune carte requise • 5 réponses IA gratuites par jour
              </div>
            </motion.div>
          </div>
          <div className="col-lg-6 d-none d-lg-block">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Image
                src="/hero-dashboard.png"
                alt="Interface AI Email Client"
                width={1200}
                height={800}
                className="rounded shadow img-fluid"
                style={{ border: '1px solid #e9ecef' }}
                priority
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
