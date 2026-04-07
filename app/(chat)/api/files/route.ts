import { listFiles } from '@/lib/core/db/files';
import type { NextRequest } from 'next/server';

function parseLimit(raw: string | null): number {
  if (!raw) {
    return 30;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return 30;
  }

  return value;
}

function parseBefore(raw: string | null): Date | undefined {
  if (!raw) {
    return undefined;
  }

  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    return undefined;
  }

  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sessionId = searchParams.get('sessionId')?.trim() || undefined;
  const sort = searchParams.get('sort') === 'asc' ? 'asc' : 'desc';

  const result = await listFiles({
    sessionId,
    limit: parseLimit(searchParams.get('limit')),
    before: parseBefore(searchParams.get('before')),
    sort,
  });

  return Response.json(result);
}
