// src/app/api/stripe/webhook/route.ts
export const dynamic = 'force-dynamic'; // ⚠️ Important pour désactiver le cache dans les routes App Router

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

// ✅ Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(req: Request) {
  console.log('🔔 Webhook Stripe déclenché');

  // ✅ Lire le body brut
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('❌ Signature absente');
    return new Response('Missing Stripe signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log('📦 Stripe Event:', event.type);
  } catch (err: any) {
    console.error('❌ Signature Stripe invalide:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ✅ Traitement de l’événement
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    console.log('📋 Metadata session:', session.metadata);

    if (!userId) {
      console.error('❌ userId manquant');
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        is_premium: true,
        premium_since: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ Supabase insert failed:', error.message);
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    console.log(`✅ Premium activé pour ${userId}`);
    return NextResponse.json({ success: true });
  }

  console.log('ℹ️ Événement ignoré:', event.type);
  return NextResponse.json({ received: true });
}
