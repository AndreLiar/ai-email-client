import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/services/stripe';
import { markUserSubscribed } from '@/services/subscription';
import { isEventProcessed, markEventProcessed } from '@/services/storage';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      console.error('[stripe/webhook] signature verification failed:', err?.message || err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    if (await isEventProcessed(event.id)) {
      return NextResponse.json({ received: true });
    }

    if (event.type !== 'checkout.session.completed') {
      await markEventProcessed(event.id, null, { type: event.type });
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (userId) {
      await markUserSubscribed(userId);
    }

    await markEventProcessed(event.id, userId ?? null, { type: event.type });
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[stripe/webhook] error:', err?.message || err);
    return NextResponse.json({ error: 'Webhook handling failed' }, { status: 500 });
  }
}
