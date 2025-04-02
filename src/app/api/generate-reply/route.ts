// src/app/api/generate-reply/route.ts
// src/app/api/generate-reply/route.ts
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { canGenerateToday } from '@/middleware/canGenerateToday';

export async function POST(req: NextRequest) {
  // ⚡️ Étape 1 : Vérification limite IA si utilisateur non-premium
  const limitCheck = await canGenerateToday();
  if (limitCheck) return limitCheck;

  // ⚡️ Étape 2 : Récupérer les données de la requête et authentifier l'utilisateur
  const body = await req.json();
  const { emailBody, prompt, sender, emailId } = body;
  const { userId } = await auth();

  console.log("📥 Données reçues :", body);
  console.log("🔐 Utilisateur :", userId);

  // ⚡️ Étape 3 : Validation des champs requis
  if (!emailBody || !sender || !emailId) {
    console.error("❌ Champs manquants : emailBody / sender / emailId");
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
  }

  // ⚡️ Étape 4 : Construire le prompt complet pour l'IA
  const fullPrompt = `
Tu es un assistant AI. Génère une réponse professionnelle à cet email reçu de ${sender} :

"${emailBody}"

Instructions supplémentaires de l'utilisateur : ${prompt || 'Aucune'}

Fais court, poli et pertinent. Ne fais pas de répétition inutile.
`;

  try {
    // ⚡️ Étape 5 : Appeler l'API Gemini pour générer une réponse
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
        }),
      }
    );

    const data = await aiRes.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Réponse vide.';

    console.log('🤖 Réponse IA générée :', reply.slice(0, 80), '...');

    // ⚡️ Étape 6 : Enregistrer la réponse dans Supabase
    if (userId) {
      const { error, data: insertData } = await supabase.from('ai_replies').insert([
        {
          user_id: userId,
          email_id: emailId,
          prompt,
          reply,
        },
      ]).select();

      if (error) {
        console.error('❌ Supabase INSERT error:', error.message, error.details);
      } else {
        console.log('✅ Supabase INSERT success:', insertData);
      }
    } else {
      console.warn("⚠️ userId est null, pas d'enregistrement Supabase.");
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('❌ Erreur Gemini API :', err);
    return NextResponse.json({ error: 'Erreur IA' }, { status: 500 });
  }
}
