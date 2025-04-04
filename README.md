
```md
# 📧 AI Email Client – Répondeur intelligent pour Gmail

Une application web moderne qui connecte ton compte Gmail, lit tes emails, et génère des réponses automatiques intelligentes grâce à l'IA Gemini.



## 🚀 Problème Résolu

Répondre manuellement à des dizaines d'emails chaque jour est long, répétitif et source d'erreurs.

**AI Email Client** t’aide à :
- Gagner du temps en générant des réponses IA contextualisées.
- Rester professionnel, même sous pression.
- Organiser tes emails et réponses automatiquement.

---

## 💡 Fonctionnalités principales
🔐 Authentification sécurisée avec Clerk
Gère ton compte et accède à tes emails en toute sécurité.

📥 Connexion directe à Gmail
Connecte ton compte Gmail via OAuth2 pour accéder à ta boîte de réception.

🤖 Génération de réponses intelligentes avec Gemini
Obtiens des réponses professionnelles prêtes à envoyer, générées par l’IA.

✍️ Prompts personnalisables
Donne un ton ou une intention à ta réponse : propose un rendez-vous, sois concis, etc.

📤 Envoi instantané via Gmail API
Envoie ta réponse générée sans quitter l'application.

🧠 Historique complet des réponses IA
Consulte toutes tes réponses passées, avec filtre par catégorie (business, urgent, personnel...).

📊 Statistiques personnalisées
Visualise ton nombre total de réponses, la moyenne de mots, et ton activité mensuelle.

💳 Abonnement Premium (via Stripe)
Accès illimité à l’IA pour des réponses sans restriction.


## 🧰 Stack technique

- **Frontend** : Next.js 15 (App Router) + Bootstrap
- **Auth** : Clerk (sign in/sign up)
- **Backend API** : Next.js API Routes
- **AI** : Gemini 1.5 Flash API (Google Generative Language)
- **Email** : Gmail API (lecture, envoi, OAuth)
- **Base de données** : Supabase
- **Paiement** : Stripe (abonnement avec webhook)
---

## ⚙️ Configuration locale

```bash
git clone https://github.com/ton-user/ai-email-client.git
cd ai-email-client
npm install
npm run dev
```

> ℹ️ Tu peux éditer `.env.local` pour configurer ton propre compte Gmail/Clerk/Supabase/Stripe.

---

## 🔑 Variables d’environnement (.env)

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `NEXT_PUBLIC_GOOGLE_AUTH_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY`
- `GEMINI_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_BASE_URL`






## 📸 Aperçu
![hero-dashboard](https://github.com/user-attachments/assets/00b56534-8da9-49de-947c-972b7eaf3b1b)
<img width="1470" alt="Screenshot 2025-04-02 at 11 55 23" src="https://github.com/user-attachments/assets/2862bb75-f851-40e3-91f7-8cc875df2ab9" />
<img width="1470" alt="Screenshot 2025-04-02 at 11 56 10" src="https://github.com/user-attachments/assets/eb09efa0-7c04-45b9-a08d-7571ecdb8c7f" />
<img width="1470" alt="Screenshot 2025-04-02 at 11 56 26" src="https://github.com/user-attachments/assets/67d0e6c3-06aa-45b9-afb3-3398e4ccd3cf" />
<img width="1470" alt="Screenshot 2025-04-02 at 12 00 04" src="https://github.com/user-attachments/assets/f22fd212-49ea-463e-aef8-ed320955b417" />
<img width="1470" alt="Screenshot 2025-04-02 at 12 00 53" src="https://github.com/user-attachments/assets/e9527ae7-ee21-4cdf-a3c7-a340093d7988" />
<img width="1470" alt="Screenshot 2025-04-02 at 12 00 36" src="https://github.com/user-attachments/assets/0de4084a-e4b2-4d88-9ca8-a7116d597278" />





