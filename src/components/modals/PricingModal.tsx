// src/components/modals/PricingModal.tsx
'use client';

import { useEffect, useRef, useCallback, useState } from "react";

export default function PricingModal({ show }: { show: boolean }) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);

  const goToCheckout = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("URL Stripe Checkout manquante");
      }
    } catch (err) {
      console.error("Erreur lors de la redirection vers Stripe :", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const modalEl = modalRef.current;
    if (!modalEl || typeof window === "undefined") return;

    import("bootstrap").then(({ Modal }) => {
      const bsModal = Modal.getOrCreateInstance(modalEl);
      if (show) {
        bsModal.show();
        modalEl.addEventListener("hidden.bs.modal", () => {
          // Optional: gérer la fermeture du modal
        });
      } else {
        bsModal.hide();
      }
    });
  }, [show]);

  return (
    <div className="modal fade" tabIndex={-1} id="pricingModal" ref={modalRef}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content text-dark">
          <div className="modal-header">
            <h5 className="modal-title">Choisissez votre plan</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" />
          </div>
          <div className="modal-body">
            <div className="row g-4">
              {/* Plan Gratuit */}
              <div className="col-md-6">
                <div className="card border-success h-100">
                  <div className="card-body text-center">
                    <h4 className="text-success">Gratuit</h4>
                    <p>
                      ✅ 5 réponses IA/jour<br />
                      ✅ Fonctionnalités de base<br />
                      🚫 Pas de support prioritaire
                    </p>
                    <button className="btn btn-outline-success w-100" disabled>
                      Activé
                    </button>
                  </div>
                </div>
              </div>

              {/* Plan Premium */}
              <div className="col-md-6">
                <div className="card border-primary h-100">
                  <div className="card-body text-center">
                    <h4 className="text-primary">Premium</h4>
                    <h5 className="mb-3">10€/mois</h5>
                    <p>
                      ✅ Réponses IA illimitées<br />
                      ✅ Statistiques avancées<br />
                      ✅ Support prioritaire
                    </p>
                    <button
                      onClick={goToCheckout}
                      className="btn btn-primary w-100"
                      disabled={loading}
                    >
                      {loading ? "Redirection..." : "Passer Premium"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-secondary"
              data-bs-dismiss="modal"
              disabled={loading}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
