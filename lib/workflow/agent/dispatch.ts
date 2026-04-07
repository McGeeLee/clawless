import { getSessionByWorkflowRunId, updateSession } from '@/lib/core/db/chat';
import { nowIso, patchWorkflowRuntime } from '@/lib/core/sandbox/runtime';
import type { AppConfig } from '@/types/config';
import type {
  ChatHookPayload,
  ChatSource,
  ToolApprovalPayload,
  WorkflowUIMessageChunk,
} from '@/types/workflow';
import type { ModelMessage } from 'ai';
import { getRun, start } from 'workflow/api';
import { ACTIVE_RUN_STATUSES } from './config';
import { approvalHookBuilder, instructionHookBuilder } from './hooks';
import { chatWorkflow } from './index';

export async function startWorkflow(input: {
  sessionId: string;
  initialMessages: ModelMessage[];
  config: AppConfig;
  source: ChatSource;
}): Promise<{
  runId: string;
  readable: ReadableStream<WorkflowUIMessageChunk>;
}> {
  const run = await start(chatWorkflow, [
    input.initialMessages,
    input.source,
    input.config,
    input.sessionId,
  ]);

  await updateSession(input.sessionId, {
    workflowRunId: run.runId,
    status: 'active',
    metadata: {
      source: input.source,
    },
  });
  await patchWorkflowRuntime(input.sessionId, {
    phase: 'running',
    lastRunId: run.runId,
    startedAt: nowIso(),
    stoppedAt: null,
    lastError: null,
  });

  return {
    runId: run.runId,
    readable: run.readable,
  };
}

export async function resumeWithMessage(
  runId: string,
  payload: ChatHookPayload,
): Promise<void> {
  if (payload.type === 'user-message') {
    await instructionHookBuilder.resume(runId, {
      type: 'user',
      message: payload.message,
      parts: payload.parts,
      uiMessageId: payload.uiMessageId,
    });
    return;
  }

  if (payload.type === 'system-message') {
    await instructionHookBuilder.resume(runId, {
      type: 'system',
      message: payload.message,
    });
    return;
  }

  await instructionHookBuilder.resume(runId, {
    type: 'control',
    command: payload.command,
    reason: payload.reason,
  });
}

export async function requestCompact(runId: string): Promise<boolean> {
  if (!(await canResumeRun(runId))) {
    return false;
  }

  await resumeWithMessage(runId, {
    type: 'control',
    command: 'compact',
  });

  return true;
}

export async function resumeToolApproval(
  toolCallId: string,
  payload: ToolApprovalPayload,
): Promise<void> {
  await approvalHookBuilder.resume(toolCallId, payload);
}

export function getWorkflowRun(runId: string) {
  return getRun(runId);
}

export async function getWorkflowStatus(
  runId: string | null,
): Promise<string | null> {
  if (!runId) {
    return null;
  }

  try {
    return await getRun(runId).status;
  } catch {
    return null;
  }
}

export async function canResumeRun(runId: string): Promise<boolean> {
  const status = await getWorkflowStatus(runId);
  return status ? ACTIVE_RUN_STATUSES.has(status) : false;
}

export async function pauseWorkflow(runId: string): Promise<void> {
  await getRun(runId).cancel();

  const session = await getSessionByWorkflowRunId(runId);
  if (!session) {
    return;
  }

  await updateSession(session.id, {
    workflowRunId: null,
    status: 'stopped',
  });
  await patchWorkflowRuntime(session.id, {
    phase: 'cancelled',
    lastRunId: runId,
    stoppedAt: nowIso(),
  });
}
