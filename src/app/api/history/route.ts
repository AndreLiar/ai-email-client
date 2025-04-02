// src/app/api/history/route.ts
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase.from('ai_replies').select('*').eq('user_id', userId);

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Erreur chargement Supabase', details: error }, { status: 500 });
  }

  return NextResponse.json(data);
}
