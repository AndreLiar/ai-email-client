import { NextResponse } from 'next/server';
import { buildGmailAuthUrl } from '@/services/auth';

export async function GET() {
  return NextResponse.redirect(buildGmailAuthUrl());
}
