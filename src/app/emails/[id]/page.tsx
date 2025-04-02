//src/app/emails/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

type EmailDetail = {
  id: string;
  subject: string;
  from: string;
  body: string;
  date?: string;
  to?: string;
};

export default function EmailDetailPage() {
  const { id } = useParams();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchEmail = async () => {
      try {
        const res = await fetch(`/api/emails/${id}`);
        const data = await res.json();
        setEmail(data);
      } catch (error) {
        console.error('Erreur chargement email:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmail();
  }, [id]);

  const generateReply = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          emailBody: email?.body,
          sender: email?.from,
          emailId: email?.id, // 👈 Nécessaire pour la sauvegarde dans Supabase
        }),
      });

      const data = await res.json();
      setAiReply(data.reply);
    } catch (error) {
      console.error('Erreur génération réponse IA:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!email || !aiReply) return;
    const confirmed = confirm('📤 Confirmer l’envoi de ce mail ?');
    if (!confirmed) return;

    setSending(true);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email.from,
          subject: `Re: ${email.subject}`,
          body: aiReply,
        }),
      });

      if (res.ok) {
        alert('✅ Email envoyé avec succès !');
      } else {
        const data = await res.json();
        alert('❌ Erreur Gmail : ' + data?.error);
      }
    } catch (error) {
      alert('💥 Erreur lors de l’envoi');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-center mt-5">📥 Chargement de l'email...</p>;
  if (!email) return <p className="text-danger mt-5 text-center">❌ Email introuvable.</p>;

  return (
    <div className="container mt-5 mb-5">
      {/* HEADER EMAIL */}
      <div className="mb-4">
        <h3 className="fw-bold">📩 {email.subject}</h3>
        <p><strong>De :</strong> {email.from}</p>
        {email.to && <p><strong>À :</strong> {email.to}</p>}
        {email.date && <p><strong>Date :</strong> {new Date(email.date).toLocaleString()}</p>}
      </div>

      {/* CORPS EMAIL */}
      <div
        className="p-4 border rounded mb-4"
        style={{
          backgroundColor: '#f8f9fa',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          lineHeight: 1.6,
          color: '#212529',
        }}
      >
        {email.body}
      </div>

      {/* SECTION RÉPONSE IA */}
      <hr className="my-4" />
      <h4>🤖 Répondre avec l'IA</h4>
      <p className="text-muted mb-2">
        Ajoute un message ou laisse vide pour laisser l'IA répondre intelligemment.
      </p>

      <div className="mb-3">
        <textarea
          className="form-control"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex : Sois poli, propose un rendez-vous lundi prochain..."
        />
      </div>

      <button
        className="btn btn-primary mb-4"
        onClick={generateReply}
        disabled={generating}
      >
        {generating ? '✍️ Génération...' : '✨ Générer la réponse'}
      </button>

      {/* RÉPONSE AFFICHÉE */}
      {aiReply && (
        <div className="mt-4">
          <h5>✉️ Réponse générée :</h5>
          <div className="bg-white border p-3 rounded">
  <ReactMarkdown>{aiReply}</ReactMarkdown>
</div>
<select
      className="form-select mt-3"
      onChange={(e) =>
        fetch('/api/update-category', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: email?.id, category: e.target.value }),
        })
      }
    >
      <option value="">🗂️ Catégoriser cette réponse</option>
      <option value="business">📊 Business</option>
      <option value="personnel">👨‍👩‍👧 Personnel</option>
      <option value="urgent">⚠️ Urgent</option>
    </select>

          <div className="mt-3 d-flex flex-wrap gap-2">
            <button
              className="btn btn-outline-secondary"
              onClick={() => navigator.clipboard.writeText(aiReply)}
            >
              📋 Copier
            </button>
            <button
              className="btn btn-outline-info"
              onClick={() => setAiReply('')}
            >
              ✏️ Modifier
            </button>
            <button
              className="btn btn-success"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? '📤 Envoi...' : '📤 Envoyer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
