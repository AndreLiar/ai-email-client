// src/app/api/auth/status/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const hasToken = !!cookieStore.get('gmail_access_token')?.value;
  return NextResponse.json({ connected: hasToken });
}
