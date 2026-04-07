import { getSession } from '@/lib/core/db/chat';
import type {
  SandboxRuntimeStatus,
  WorkflowRuntimePhase,
} from '@/lib/core/sandbox/runtime';
import { getSessionRuntimeMetadata } from '@/lib/core/sandbox/runtime';
import {
  type RuntimeHealthSnapshot,
  getRuntimeHealthSnapshot,
} from '@/lib/utils/runtime-health';

export type WorkflowRuntimeStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'stopped'
  | 'error'
  | null;

export interface SessionRuntimeResponse {
  sessionId: string;
  environment: RuntimeHealthSnapshot | null;
  workflow: {
    runId: string | null;
    status: WorkflowRuntimeStatus;
    phase: WorkflowRuntimePhase;
    canCancel: boolean;
    startedAt: string | null;
    stoppedAt: string | null;
    durationMs: number;
    lastError: string | null;
  };
  approval: {
    toolCallId: string | null;
    toolName: string | null;
    status: 'pending' | 'approved' | 'rejected' | null;
    comment: string | null;
    requestedAt: string | null;
    respondedAt: string | null;
  };
  sandbox: {
    sandboxId: string | null;
    status: SandboxRuntimeStatus;
    canStop: boolean;
    startedAt: string | null;
    lastActiveAt: string | null;
    stoppedAt: string | null;
    durationMs: number;
    timeoutMs: number | null;
    publicPorts: number[];
    lastCommand: string | null;
    lastExitCode: number | null;
    lastError: string | null;
  };
}

const CANCELABLE_RUN_STATUSES = new Set(['pending', 'running']);

function deriveWorkflowStatus(input: {
  runId: string | null;
  sessionStatus: string | null;
  workflowPhase: WorkflowRuntimePhase | null;
}): WorkflowRuntimeStatus {
  if (!input.runId) {
    return null;
  }

  if (input.sessionStatus === 'active' || input.workflowPhase === 'running') {
    return 'running';
  }

  if (
    input.workflowPhase === 'completed' ||
    input.sessionStatus === 'completed'
  ) {
    return 'completed';
  }

  if (
    input.workflowPhase === 'cancelled' ||
    input.sessionStatus === 'stopped'
  ) {
    return 'stopped';
  }

  if (input.workflowPhase === 'error' || input.sessionStatus === 'error') {
    return 'error';
  }

  return 'pending';
}

function toDurationMs(
  startedAt: string | null,
  stoppedAt: string | null,
): number {
  if (!startedAt) {
    return 0;
  }

  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) {
    return 0;
  }

  const end = stoppedAt ? new Date(stoppedAt).getTime() : Date.now();
  return Math.max(0, end - start);
}

export async function getSessionRuntime(
  sessionId: string,
): Promise<SessionRuntimeResponse | null> {
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  const metadata = getSessionRuntimeMetadata(session.metadata ?? null);
  const latestApproval =
    (metadata.latestApproval as
      | {
          toolCallId?: string | null;
          toolName?: string | null;
          status?: 'pending' | 'approved' | 'rejected' | null;
          comment?: string | null;
          requestedAt?: string | null;
          respondedAt?: string | null;
        }
      | undefined) ?? undefined;
  const runId = session.workflowRunId ?? metadata.workflow.lastRunId ?? null;
  const runStatus = deriveWorkflowStatus({
    runId,
    sessionStatus: session.status ?? null,
    workflowPhase: metadata.workflow.phase,
  });

  const workflowStartedAt =
    metadata.workflow.startedAt ?? session.createdAt.toISOString();

  return {
    sessionId,
    environment: getRuntimeHealthSnapshot(),
    workflow: {
      runId,
      status: runStatus,
      phase: metadata.workflow.phase,
      canCancel:
        runId !== null &&
        runStatus !== null &&
        CANCELABLE_RUN_STATUSES.has(runStatus),
      startedAt: workflowStartedAt,
      stoppedAt: metadata.workflow.stoppedAt,
      durationMs: toDurationMs(workflowStartedAt, metadata.workflow.stoppedAt),
      lastError: metadata.workflow.lastError,
    },
    approval: {
      toolCallId: latestApproval?.toolCallId ?? null,
      toolName: latestApproval?.toolName ?? null,
      status: latestApproval?.status ?? null,
      comment: latestApproval?.comment ?? null,
      requestedAt: latestApproval?.requestedAt ?? null,
      respondedAt: latestApproval?.respondedAt ?? null,
    },
    sandbox: {
      sandboxId: session.sandboxId ?? null,
      status: session.sandboxId ? metadata.sandbox.status : 'idle',
      canStop:
        session.sandboxId !== null &&
        (metadata.sandbox.status === 'running' ||
          metadata.sandbox.status === 'pending'),
      startedAt: metadata.sandbox.startedAt,
      lastActiveAt: metadata.sandbox.lastActiveAt,
      stoppedAt: metadata.sandbox.stoppedAt,
      durationMs: toDurationMs(
        metadata.sandbox.startedAt,
        metadata.sandbox.stoppedAt,
      ),
      timeoutMs: metadata.sandbox.timeoutMs,
      publicPorts: metadata.sandbox.publicPorts,
      lastCommand: metadata.sandbox.lastCommand,
      lastExitCode: metadata.sandbox.lastExitCode,
      lastError: metadata.sandbox.lastError,
    },
  };
}
