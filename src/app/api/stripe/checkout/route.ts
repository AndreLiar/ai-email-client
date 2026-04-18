import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/services/stripe';

const PLACEHOLDER_PRICE_ID = 'price_placeholder_monthly';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: PLACEHOLDER_PRICE_ID,
          quantity: 1,
        },
      ],
      metadata: { userId },
      success_url: 'http://localhost:3000/cleaner?success=true',
      cancel_url: 'http://localhost:3000/cleaner?canceled=true',
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
