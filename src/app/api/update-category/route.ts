// src/app/api/update-category/route.ts
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const body = await req.json();
  const { id, category } = body;

  if (!userId || !id || !category) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const { error } = await supabase
    .from('ai_replies')
    .update({ category })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: 'Erreur update Supabase', details: error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
