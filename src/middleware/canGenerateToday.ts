// src/middleware/canGenerateToday.ts
import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function canGenerateToday() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Récupération du statut premium depuis Clerk
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const isPremium = user.publicMetadata?.is_premium === true;

  // ✅ Si Premium, accès illimité
  if (isPremium) return null;

  // 🔢 Sinon, on limite à 5 réponses par jour
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  const { count, error } = await supabase
    .from('ai_replies')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00`);

  if (error) {
    console.error('❌ Erreur Supabase :', error.message);
    return NextResponse.json({ error: 'Erreur vérification quota' }, { status: 500 });
  }

  const MAX_FREE_LIMIT = 5;
  if ((count ?? 0) >= MAX_FREE_LIMIT) {
    return NextResponse.json(
      {
        error: `Limite atteinte : ${MAX_FREE_LIMIT} réponses IA par jour. Passe en Premium pour continuer.`,
      },
      { status: 403 }
    );
  }

  // Autorisé
  return null;
}
