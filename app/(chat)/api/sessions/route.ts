import { deserializePersistedMessages } from '@/lib/chat/persistence';
import {
  getVisibleSessionMessagesPage,
  listSessions,
} from '@/lib/core/db/chat';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sessionId = searchParams.get('id') ?? undefined;

  if (sessionId) {
    const rawLimit = searchParams.get('limit');
    const parsedLimit = rawLimit ? Number(rawLimit) : 20;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 20;
    const beforeStr = searchParams.get('before');
    const before = beforeStr ? new Date(beforeStr) : undefined;
    const parsedBefore =
      before && !Number.isNaN(before.getTime()) ? before : undefined;

    const page = await getVisibleSessionMessagesPage(sessionId, {
      limit,
      before: parsedBefore,
    });

    return Response.json({
      sessionId,
      messages: deserializePersistedMessages(page.messages),
      hasMore: page.hasMore,
      nextBefore: page.nextBefore,
    });
  }

  const channel = searchParams.get('channel') ?? undefined;
  const archived = searchParams.get('archived') === 'true';
  const rawLimit = searchParams.get('limit');
  const limit = rawLimit ? Number(rawLimit) : 50;

  const sessions = await listSessions({ channel, archived, limit });
  return Response.json({ sessions });
}
