import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthConfigStatus } from '@/lib/auth/config';
import { AUTH_COOKIE_NAME } from '@/lib/auth/constants';
import { verifyAuthToken } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';

function normalizeRedirectTo(input: string | undefined): string {
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const resolvedParams = await searchParams;
  const nextPath = normalizeRedirectTo(resolvedParams.redirectTo);
  const authConfig = getAuthConfigStatus();

  if (!authConfig.isConfigured) {
    return (
      <main className="min-h-dvh bg-gradient-to-b from-background to-muted/20 px-6 py-12">
        <div className="mx-auto flex min-h-[70dvh] max-w-5xl items-center justify-center">
          <Card className="w-full max-w-2xl border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Authentication setup required</CardTitle>
              <CardDescription>
                Sign in is disabled until the server is configured with
                `AUTH_SECRET`, `username`, and `password`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
                <p>
                  Add the missing variables to <code>.env.local</code> or{' '}
                  <code>.env</code>, then restart the app.
                </p>
                <p className="mt-2">
                  Missing now: {authConfig.missingEnvVars.join(', ')}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Example env file</p>
                <pre className="overflow-x-auto rounded-md bg-zinc-950 p-4 text-sm text-zinc-50">
                  <code>{authConfig.exampleEnvFile}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifyAuthToken(token);

  if (session) {
    redirect(nextPath);
  }

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-muted/20 px-6 py-12">
      <div className="mx-auto flex min-h-[70dvh] max-w-5xl items-center justify-center">
        <LoginForm redirectTo={nextPath} />
      </div>
    </main>
  );
}
