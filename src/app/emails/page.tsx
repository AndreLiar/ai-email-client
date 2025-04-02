//src/app/emails/page.tsx
'use client';

import ProtectedLayout from "@/components/layouts/ProtectedLayout";
import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from 'react-markdown';

type Email = {
  id: string;
  subject: string;
  from: string;
  snippet: string;
};

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const GOOGLE_AUTH_URL = process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL!;

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const res = await fetch('/api/emails');
        const contentType = res.headers.get("content-type");

        if (res.ok && contentType?.includes("application/json")) {
          const data = await res.json();
          setEmails(data);
          setIsAuthenticated(true);
        } else if (res.status === 403) {
          setIsAuthenticated(false);
          setError("❌ Gmail non connecté. Clique sur le bouton ci-dessous pour lier ton compte.");
        } else {
          const text = await res.text(); // fallback
          console.error("💥 Erreur inattendue:", text);
          setError("Une erreur est survenue. Merci de réessayer.");
        }
      } catch (error) {
        console.error('Erreur fetch emails:', error);
        setError("Erreur de connexion au serveur.");
      } finally {
        setLoading(false);
      }
    };

    fetchEmails();
  }, []);

  if (!isAuthenticated) {
    return (
      <ProtectedLayout>
        <div className="text-center mt-5">
          <h1 className="mb-4">📧 Connecte ton compte Gmail</h1>
          {error && <p className="alert alert-warning">{error}</p>}
          <a href={GOOGLE_AUTH_URL} className="btn btn-danger">
            Connecter Gmail
          </a>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <h1 className="mb-4">📥 Boîte de réception Gmail</h1>
      {loading ? (
        <p>Chargement...</p>
      ) : (
        <ul className="list-group">
        {emails.map((email) => (
  <li key={email.id} className="list-group-item">
    <Link href={`/emails/${email.id}`} className="text-decoration-none text-dark">
      <h5>{email.subject}</h5>
      <p><strong>De :</strong> {email.from}</p>
      <p className="text-muted">{email.snippet}</p>
    </Link>
  </li>
))}
        </ul>
      )}
    </ProtectedLayout>
  );
}
