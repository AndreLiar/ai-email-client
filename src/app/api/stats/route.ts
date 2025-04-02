// src/app/api/stats/route.ts
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1️⃣ Récupère toutes les réponses de l'utilisateur
    const { data, error } = await supabase
      .from('ai_replies')
      .select('reply, created_at')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Erreur chargement Supabase :', error);
      return NextResponse.json({ error: 'Erreur Supabase' }, { status: 500 });
    }

    // 2️⃣ Calculs statistiques
    const total = data.length;

    const averageWords =
      total === 0
        ? 0
        : Math.round(
            data.reduce((sum, item) => sum + item.reply.split(/\s+/).length, 0) / total
          );

    // 3️⃣ Groupé par mois (format court)
    const monthlyMap: Record<string, number> = {};

    data.forEach((item) => {
      const date = new Date(item.created_at);
      const month = date.toLocaleString('fr-FR', { month: 'short' }); // ex: "janv", "févr"
      monthlyMap[month] = (monthlyMap[month] || 0) + 1;
    });

    const monthly = Object.entries(monthlyMap).map(([month, count]) => ({
      month,
      count,
    }));

    return NextResponse.json({
      total,
      averageWords,
      monthly,
    });
  } catch (err) {
    console.error('❌ Erreur serveur /api/stats :', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
