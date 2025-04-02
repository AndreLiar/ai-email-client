// src/app/history/page.tsx
'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type HistoryItem = {
  id: string;
  email_id: string;
  prompt: string;
  reply: string;
  created_at: string;
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/history');
        const data = await res.json();
        console.log('📚 Historique chargé :', data);
        setHistory(data);
      } catch (err) {
        console.error('❌ Erreur chargement historique:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);
<div className="mb-4">
  <select
    className="form-select"
    onChange={(e) => {
      const cat = e.target.value;
      const url = cat === 'all' ? '/api/history' : `/api/history?category=${cat}`;
      fetch(url)
        .then((res) => res.json())
        .then(setHistory);
    }}
  >
    <option value="all">🧾 Toutes les catégories</option>
    <option value="business">📊 Business</option>
    <option value="personnel">👨‍👩‍👧 Personnel</option>
    <option value="urgent">⚠️ Urgent</option>
  </select>
</div>

  return (
    <div className="container mt-4">
      <h2 className="mb-4">🧠 Historique des réponses IA</h2>

      {loading ? (
        <p>⏳ Chargement...</p>
      ) : history.length === 0 ? (
        <p className="text-muted">Aucune réponse générée pour l’instant.</p>
      ) : (
        <ul className="list-group">
          {history.map((item) => (
            <li key={item.id} className="list-group-item mb-4">
              <p className="text-muted mb-1">📅 {new Date(item.created_at).toLocaleString()}</p>
              <p className="mb-1">
                <strong>✉️ Email :</strong>{' '}
                <a href={`/emails/${item.email_id}`} className="link-primary">
                  Voir le message
                </a>
              </p>
              {item.prompt && (
                <p className="mb-1">
                  <strong>📝 Prompt :</strong> {item.prompt}
                </p>
              )}
              <div className="mt-2 bg-light p-3 border rounded">
                <ReactMarkdown>{item.reply}</ReactMarkdown>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
