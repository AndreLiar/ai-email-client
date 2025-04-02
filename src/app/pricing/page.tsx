// src/app/pricing/page.tsx
// src/app/pricing/page.tsx
'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export default function PricingPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  // Fonction pour créer une session Stripe Checkout
  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user?.id }), // Passer l'ID de l'utilisateur à Stripe
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la création de la session Stripe');
      }

      const data = await res.json();
      window.location.href = data.url; // Rediriger vers Stripe Checkout
    } catch (error) {
      console.error('❌ Erreur Stripe :', error);
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5 text-center">
      <h1 className="mb-4">💳 Tarifs & Abonnements</h1>

      <div className="row justify-content-center">
        {/* Plan Gratuit */}
        <div className="col-md-4">
          <div className="card border shadow-sm mb-4">
            <div className="card-body">
              <h5 className="card-title">🆓 Gratuit</h5>
              <p className="card-text">
                - 5 réponses IA / jour<br />
                - Historique illimité<br />
                - Connexion Gmail
              </p>
            </div>
          </div>
        </div>

        {/* Plan Premium */}
        <div className="col-md-4">
          <div className="card border shadow mb-4 bg-light">
            <div className="card-body">
              <h5 className="card-title">🚀 Premium</h5>
              <p className="card-text">
                - Réponses IA illimitées<br />
                - Support prioritaire<br />
                - + d’options IA à venir
              </p>
              <button
                className="btn btn-success"
                onClick={handleCheckout}
                disabled={loading}
              >
                {loading ? '🔄 Redirection...' : 'Passer Premium'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
