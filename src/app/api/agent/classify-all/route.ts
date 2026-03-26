import { NextRequest, NextResponse } from 'next/server';
import { classifyAllSenders } from '@/services/ai';

export async function POST(req: NextRequest) {
  const { senders } = await req.json();
  if (!Array.isArray(senders) || senders.length === 0) {
    return NextResponse.json({ classifications: [] });
  }

  try {
    const classifications = await classifyAllSenders(
      senders.map((s: any) => ({ email: s.email, displayName: s.displayName }))
    );
    return NextResponse.json({ classifications });
  } catch (err: any) {
    console.error('[classify-all] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
