import {
  createLongTermMemory,
  listLongTermMemories,
  searchLongTermMemories,
} from '@/lib/memory';
import {
  createLongTermMemorySchema,
  longTermMemoryListQuerySchema,
  longTermMemorySearchQuerySchema,
} from '@/types/memory';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get('query')?.trim();

  if (query) {
    const parsed = longTermMemorySearchQuerySchema.safeParse({
      query,
      minConfidence: params.get('minConfidence') ?? undefined,
      page: params.get('page') ?? undefined,
      pageSize: params.get('pageSize') ?? undefined,
    });

    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const results = await searchLongTermMemories(parsed.data);

    return Response.json({
      search: true,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      results,
    });
  }

  const parsed = longTermMemoryListQuerySchema.safeParse({
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? params.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const items = await listLongTermMemories(parsed.data);

  return Response.json({
    search: false,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    items,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createLongTermMemorySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await createLongTermMemory(parsed.data);
  return Response.json(result);
}
