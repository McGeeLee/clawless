import {
  type PersistedMessageRecord,
  normalizeToolOutputForPersistence,
  reconstructUIMessageParts,
  toModelMessage,
} from '@/lib/chat/message-utils';
import { getSessionMessages } from '@/lib/core/db/chat';
import { getCurrentSessionSummary } from '@/lib/memory';
import type { PersistedMessageRole, WorkflowUIMessage } from '@/types/workflow';
import type { ModelMessage } from 'ai';

const SUMMARY_MESSAGE_PREFIX = '[Conversation Summary]\n';
type ToolModelMessagePart = Exclude<
  Extract<ModelMessage, { role: 'tool' }>['content'],
  string
>[number];
type ToolResultOutput = Extract<
  ToolModelMessagePart,
  { type: 'tool-result' }
>['output'];

export function createSummaryModelMessage(summaryText: string): ModelMessage {
  return {
    role: 'user',
    content: `${SUMMARY_MESSAGE_PREFIX}${summaryText}`,
  };
}

async function getConversationRowsAfterLatestSummary(sessionId: string) {
  const [summary, rows] = await Promise.all([
    getCurrentSessionSummary(sessionId),
    getSessionMessages(sessionId),
  ]);

  const latestSummaryIndex = rows.findLastIndex(
    (row) => row.role === 'summary',
  );

  return {
    summaryText: summary?.content ?? null,
    rows: latestSummaryIndex >= 0 ? rows.slice(latestSummaryIndex + 1) : rows,
  };
}

function mapPersistedToolOutputToModelOutput(input: {
  toolState?: unknown;
  output?: unknown;
  error?: unknown;
}): ToolResultOutput {
  if (input.toolState === 'output-denied') {
    return {
      type: 'execution-denied',
      reason:
        typeof input.output === 'string'
          ? input.output
          : typeof input.error === 'string'
            ? input.error
            : undefined,
    };
  }

  if (typeof input.output === 'string') {
    return {
      type: 'text',
      value: input.output,
    };
  }

  if (input.output !== undefined) {
    return {
      type: 'text',
      value: normalizeToolOutputForPersistence(input.output, 8_000),
    };
  }

  if (typeof input.error === 'string' && input.error.trim().length > 0) {
    return {
      type: 'error-text',
      value: input.error,
    };
  }

  return {
    type: 'text',
    value: 'Tool execution finished without output.',
  };
}

function mapToolRowToInitialModelMessage(
  row: Pick<PersistedMessageRecord, 'payload'>,
): ModelMessage | null {
  const toolCallId =
    typeof row.payload.toolCallId === 'string'
      ? row.payload.toolCallId.trim()
      : '';
  const toolName =
    typeof row.payload.toolName === 'string' ? row.payload.toolName.trim() : '';

  if (toolCallId.length === 0 || toolName.length === 0) {
    return null;
  }

  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId,
        toolName,
        output: mapPersistedToolOutputToModelOutput({
          toolState: row.payload.toolState,
          output: row.payload.output,
          error: row.payload.error,
        }),
      },
    ],
  };
}

export async function buildPostSummaryConversationMessages(
  sessionId: string,
  options?: {
    modelId?: string | null;
    allowFileParts?: boolean;
  },
): Promise<{
  summaryText: string | null;
  uiMessages: Array<Omit<WorkflowUIMessage, 'id'>>;
  modelMessages: ModelMessage[];
}> {
  const { summaryText, rows } =
    await getConversationRowsAfterLatestSummary(sessionId);
  const uiMessageRows = rows.filter(
    (row) => row.role === 'user' || row.role === 'assistant',
  );
  const modelMessages = rows.flatMap((row) => {
    if (row.role === 'tool') {
      const message = mapToolRowToInitialModelMessage(row);
      return message ? [message] : [];
    }

    if (row.role !== 'user' && row.role !== 'assistant') {
      return [];
    }

    const message = toModelMessage(row, {
      modelId: options?.modelId,
      allowFileParts: options?.allowFileParts,
    });
    return message ? [message] : [];
  });

  return {
    summaryText,
    uiMessages: uiMessageRows.map((row) => ({
      role: row.role === 'user' ? 'user' : 'assistant',
      parts: reconstructUIMessageParts(row),
    })),
    modelMessages,
  };
}

export async function buildInitialContextMessages(
  sessionId: string,
  options?: {
    modelId?: string | null;
    allowFileParts?: boolean;
  },
): Promise<ModelMessage[]> {
  const { summaryText, modelMessages } =
    await buildPostSummaryConversationMessages(sessionId, options);

  return summaryText
    ? [createSummaryModelMessage(summaryText), ...modelMessages]
    : modelMessages;
}

function mapToolRowToCompressionMessage(input: {
  toolName: string;
  role: PersistedMessageRole;
  toolInput?: unknown;
  toolOutput?: unknown;
}): ModelMessage {
  const sections = [
    `[tool:${input.toolName}]`,
    input.toolInput === undefined
      ? null
      : `input:\n${normalizeToolOutputForPersistence(input.toolInput, 4_000)}`,
    input.toolOutput === undefined
      ? null
      : `output:\n${normalizeToolOutputForPersistence(input.toolOutput, 8_000)}`,
  ].filter((value): value is string => Boolean(value));

  return {
    role: input.role === 'user' ? 'user' : 'assistant',
    content: sections.join('\n\n'),
  };
}

export async function buildCompressionConversationMessages(sessionId: string) {
  const { rows } = await getConversationRowsAfterLatestSummary(sessionId);

  return rows.flatMap((row) => {
    if (row.role === 'user' || row.role === 'assistant') {
      const message = toModelMessage(row, { allowFileParts: false });
      return message ? [message] : [];
    }

    if (row.role === 'tool' && typeof row.payload.toolName === 'string') {
      return [
        mapToolRowToCompressionMessage({
          role: row.role,
          toolName: row.payload.toolName,
          toolInput: row.payload.input,
          toolOutput: row.payload.output,
        }),
      ];
    }

    return [];
  });
}
