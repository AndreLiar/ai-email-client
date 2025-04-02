// src/components/landing/Testimonials.tsx
'use client';
import { motion } from "framer-motion";

const testimonials = [
  {
    quote: "Je gagne 1h par jour grâce à l'IA. L'interface est fluide et très professionnelle.",
    author: "Sophie, Freelance",
    rating: 5,
  },
  {
    quote: "Idéal pour traiter mes mails clients sans stress. Le plan gratuit est déjà très complet !",
    author: "Mehdi, Étudiant",
    rating: 4,
  },
  {
    quote: "J'ai pris l'abonnement Premium directement après l'essai. Rien à redire, ça change la vie !",
    author: "Clara, Coach professionnelle",
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section className="py-5">
      <div className="container">
        <div className="text-center mb-5">
          <h2 className="fw-bold">Ce que nos utilisateurs en disent</h2>
          <p className="lead text-muted">Découvrez comment AI Email Client transforme leur quotidien</p>
        </div>

        <div className="row g-4">
          {testimonials.map((t, index) => (
            <motion.div
              key={index}
              className="col-md-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body p-4">
                  <div className="mb-3 text-warning">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <i key={i} className="bi bi-star-fill"></i>
                    ))}
                  </div>
                  <p className="fst-italic mb-4">"{t.quote}"</p>
                  <p className="fw-bold mb-0">— {t.author}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
