import { NextResponse } from 'next/server';
import { isGmailConnected } from '@/services/auth';

export async function GET() {
  const connected = await isGmailConnected();
  return NextResponse.json({ connected });
}
