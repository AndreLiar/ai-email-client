// src/app/api/auth/disconnect/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('gmail_access_token');
  response.cookies.delete('gmail_refresh_token');
  return response;
}
