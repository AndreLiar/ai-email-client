// src/components/landing/PricingCTA.tsx
'use client';

import { SignedOut, SignInButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { useState } from "react";
import PricingModal from "../modals/PricingModal";

export default function PricingCTA() {
  const [showModal, setShowModal] = useState(false);

  return (
    <SignedOut>
      <section id="tarifs" className="py-5 bg-primary text-white">
        <div className="container text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="fw-bold mb-3">Prêt à révolutionner votre boîte mail ?</h2>
            <p className="lead mb-4">Essayez gratuitement pendant 14 jours, sans carte de crédit</p>
            <div className="d-flex justify-content-center gap-3">
              <SignInButton mode="modal">
                <button className="btn btn-light btn-lg px-4 text-primary fw-bold">
                  Commencer maintenant
                </button>
              </SignInButton>

              <button
                className="btn btn-outline-light btn-lg px-4"
                onClick={() => setShowModal(true)}
              >
                Voir les tarifs
              </button>
            </div>
          </motion.div>
        </div>

        {/* ✅ Intégration du modal Bootstrap encapsulé */}
        <PricingModal show={showModal} />
      </section>
    </SignedOut>
  );
}
