import { AUTH_COOKIE_NAME } from '@/lib/auth/constants';
import { getExpiredAuthCookieOptions } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(AUTH_COOKIE_NAME, '', getExpiredAuthCookieOptions());
  return response;
}
