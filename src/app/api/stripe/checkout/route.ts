import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripe } from '@/services/stripe';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId },
      success_url: `${appUrl}/cleaner?success=true`,
      cancel_url: `${appUrl}/cleaner?canceled=true`,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Checkout session URL unavailable' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('[stripe/checkout] error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
