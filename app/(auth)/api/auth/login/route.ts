import { getAuthConfigStatus } from '@/lib/auth/config';
import { AUTH_COOKIE_NAME, AUTH_TTL_SECONDS } from '@/lib/auth/constants';
import { validateCredentials } from '@/lib/auth/credentials';
import { createAuthToken, getAuthCookieOptions } from '@/lib/auth/session';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

function normalizeRedirectTo(input: string | null | undefined): string {
  if (!input) {
    return '/';
  }

  if (!input.startsWith('/') || input.startsWith('//')) {
    return '/';
  }

  if (input.startsWith('/login')) {
    return '/';
  }

  return input;
}

export async function POST(request: NextRequest) {
  const authConfig = getAuthConfigStatus();
  if (!authConfig.isConfigured) {
    return NextResponse.json(
      {
        error:
          'Authentication is not configured. Set AUTH_SECRET, username, and password in .env.local or .env, then restart the app.',
        missingEnvVars: authConfig.missingEnvVars,
        exampleEnvFile: authConfig.exampleEnvFile,
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Username and password are required.' },
      { status: 400 },
    );
  }

  const { username, password } = parsed.data;
  const isValid = validateCredentials({ username, password });
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid username or password.' },
      { status: 401 },
    );
  }

  const token = await createAuthToken(username);
  const response = NextResponse.json(
    {
      ok: true,
      redirectTo: normalizeRedirectTo(
        request.nextUrl.searchParams.get('redirectTo'),
      ),
    },
    { status: 200 },
  );

  response.cookies.set(
    AUTH_COOKIE_NAME,
    token,
    getAuthCookieOptions(Date.now() + AUTH_TTL_SECONDS * 1000),
  );

  return response;
}
