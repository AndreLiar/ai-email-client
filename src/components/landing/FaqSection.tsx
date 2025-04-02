// src/components/landing/FaqSection.tsx
'use client';
const questions = [
  {
    q: "Est-ce que mes emails sont stockés sur vos serveurs ?",
    a: "Non. Nous n'enregistrons aucun email, tout reste sécurisé via Google OAuth.",
  },
  {
    q: "Quelle version de Gemini est utilisée ?",
    a: "Nous utilisons Gemini 1.5 Flash (Google AI).",
  },
  {
    q: "Quelle est la différence entre les plans Gratuit et Premium ?",
    a: "Gratuit = 5 réponses/jour. Premium (10€/mois) = réponses illimitées + fonctions avancées.",
  },
  {
    q: "Puis-je annuler mon abonnement ?",
    a: "Oui, à tout moment via votre tableau de bord.",
  },
  {
    q: "Fonctionne-t-il avec autre chose que Gmail ?",
    a: "Pas encore, mais Outlook arrive bientôt.",
  },
];

export default function FaqSection() {
  return (
    <section id="faq" className="py-5 bg-light">
      <div className="container">
        <div className="text-center mb-5">
          <h2 className="fw-bold">Questions fréquentes</h2>
          <p className="lead text-muted">Trouvez rapidement les réponses à vos questions</p>
        </div>
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="accordion" id="faqAccordion">
              {questions.map((item, index) => (
                <div key={index} className="accordion-item border-0 shadow-sm mb-3">
                  <h3 className="accordion-header">
                    <button
                      className="accordion-button collapsed"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#faq-${index}`}
                    >
                      {item.q}
                    </button>
                  </h3>
                  <div id={`faq-${index}`} className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body">{item.a}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
