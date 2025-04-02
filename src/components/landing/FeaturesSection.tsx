// src/components/landing/FeaturesSection.tsx
'use client';
import { motion } from "framer-motion";

const features = [
  {
    icon: "⚡",
    title: "Réponses instantanées",
    description: "L'IA génère des réponses pertinentes en quelques secondes",
  },
  {
    icon: "🔒",
    title: "Sécurité maximale",
    description: "Connexion OAuth sécurisée avec Google, aucun stockage de vos emails",
  },
  {
    icon: "📊",
    title: "Analytiques avancées",
    description: "Suivez votre productivité avec des statistiques détaillées",
  },
  {
    icon: "🤖",
    title: "Gemini 1.5",
    description: "Technologie IA de pointe pour des réponses naturelles",
  },
];

export default function FeaturesSection() {
  return (
    <section id="fonctionnalites"  className="py-5">
      <div className="container">
        <div className="text-center mb-5">
          <h2 className="fw-bold">Comment ça marche ?</h2>
          <p className="lead text-muted">Une solution simple pour une productivité maximale</p>
        </div>

        <div className="row g-4">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="col-md-6 col-lg-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body text-center p-4">
                  <div className="display-4 mb-3">{feature.icon}</div>
                  <h5 className="card-title">{feature.title}</h5>
                  <p className="card-text text-muted">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
