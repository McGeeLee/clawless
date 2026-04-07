import {
  type SerializedMessageForDB,
  serializeSummaryMessage,
} from '@/lib/chat/message-utils';
import { saveMessages } from '@/lib/core/db/chat';
import {
  clearCurrentSessionSummaryRow,
  getCurrentSessionSummaryRow,
  listSessionSummaryRows,
  saveSessionSummaryRow,
} from '@/lib/core/db/memory/session';

export async function getCurrentSessionSummary(sessionId: string) {
  return getCurrentSessionSummaryRow(sessionId);
}

export async function listSessionSummaries(sessionId: string) {
  return listSessionSummaryRows(sessionId);
}

export async function invalidateCurrentSessionSummary(sessionId: string) {
  await clearCurrentSessionSummaryRow(sessionId);
}

export async function writeSummaryFromCompaction(input: {
  sessionId: string;
  summaryText: string;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const summaryText = input.summaryText.trim();
  if (summaryText.length === 0) {
    return { changed: false as const, summary: null };
  }

  const current = await getCurrentSessionSummaryRow(input.sessionId);
  if (current?.content === summaryText) {
    return { changed: false as const, summary: current };
  }

  const createdAt = input.createdAt ?? new Date();
  const summary = await saveSessionSummaryRow(input.sessionId, summaryText);

  const summaryMessage = serializeSummaryMessage({
    sessionId: input.sessionId,
    summaryText,
    createdAt,
  });
  const payload: SerializedMessageForDB = {
    ...summaryMessage,
    payload: {
      ...summaryMessage.payload,
      metadata: input.metadata,
    },
  };

  await saveMessages([payload]);

  return { changed: true as const, summary };
}
