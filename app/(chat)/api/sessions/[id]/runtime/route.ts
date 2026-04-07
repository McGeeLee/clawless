import { getSessionRuntime } from '@/lib/core/sandbox/session-runtime';
import type { NextRequest } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const runtime = await getSessionRuntime(id);

  if (!runtime) {
    return Response.json({ error: 'Session not found.' }, { status: 404 });
  }

  return Response.json(runtime);
}
