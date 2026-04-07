import { getCurrentSessionSummary, listSessionSummaries } from '@/lib/memory';
import { sessionMemoryQuerySchema } from '@/types/memory';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const parsed = sessionMemoryQuerySchema.safeParse({
    sessionId: request.nextUrl.searchParams.get('sessionId'),
  });

  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [current, summaries] = await Promise.all([
    getCurrentSessionSummary(parsed.data.sessionId),
    listSessionSummaries(parsed.data.sessionId),
  ]);

  return Response.json({
    sessionId: parsed.data.sessionId,
    current,
    summaries,
  });
}
