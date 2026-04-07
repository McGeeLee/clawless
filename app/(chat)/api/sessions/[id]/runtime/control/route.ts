import { getSession, updateSession } from '@/lib/core/db/chat';
import { stopSessionSandbox } from '@/lib/core/sandbox';
import { nowIso, patchWorkflowRuntime } from '@/lib/core/sandbox/runtime';
import { getSessionRuntime } from '@/lib/core/sandbox/session-runtime';
import { createLogger } from '@/lib/utils/logger';
import { resumeToolApproval } from '@/lib/workflow/agent/dispatch';
import { getRun } from 'workflow/api';
import { z } from 'zod';

const logger = createLogger('api.sessions.runtime.control');

const requestSchema = z.discriminatedUnion('target', [
  z.object({
    target: z.literal('workflow'),
    action: z.literal('cancel'),
  }),
  z.object({
    target: z.literal('sandbox'),
    action: z.literal('stop'),
  }),
  z.object({
    target: z.literal('approval'),
    action: z.enum(['approve', 'reject']),
    toolCallId: z.string().trim().min(1).optional(),
    comment: z.string().trim().optional(),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) {
    return Response.json({ error: 'Session not found.' }, { status: 404 });
  }

  const input = requestSchema.parse(await request.json());
  const runtime = await getSessionRuntime(id);
  if (!runtime) {
    return Response.json({ error: 'Session not found.' }, { status: 404 });
  }

  try {
    if (input.target === 'workflow') {
      if (!runtime.workflow.canCancel || !runtime.workflow.runId) {
        return Response.json(
          { error: 'Workflow is not running.' },
          { status: 409 },
        );
      }

      await getRun(runtime.workflow.runId).cancel();
      await updateSession(id, {
        workflowRunId: null,
        status: 'stopped',
      });
      await patchWorkflowRuntime(id, {
        phase: 'cancelled',
        stoppedAt: nowIso(),
        lastRunId: runtime.workflow.runId,
      });
      logger.info('workflow:cancelled', {
        sessionId: id,
        runId: runtime.workflow.runId,
      });
    } else if (input.target === 'sandbox') {
      if (!runtime.sandbox.canStop) {
        return Response.json(
          { error: 'Sandbox is not running.' },
          { status: 409 },
        );
      }

      await stopSessionSandbox(id);
      logger.info('sandbox:stopped', {
        sessionId: id,
        sandboxId: runtime.sandbox.sandboxId,
      });
    } else {
      const latestApproval =
        (session.metadata?.latestApproval as
          | {
              toolCallId?: string;
              toolName?: string;
              hookToken?: string;
              requestedAt?: string;
            }
          | undefined) ?? undefined;

      const explicitToolCallId = input.toolCallId?.trim();
      const toolCallId =
        explicitToolCallId ||
        runtime.approval.toolCallId ||
        latestApproval?.toolCallId ||
        '';
      const candidateHookTokens = Array.from(
        new Set(
          [
            latestApproval?.hookToken,
            runtime.workflow.runId
              ? `${runtime.workflow.runId}:${toolCallId}`
              : undefined,
            toolCallId,
          ].filter((value): value is string => Boolean(value)),
        ),
      );
      const comment = input.comment?.trim() || undefined;

      if (!toolCallId) {
        return Response.json(
          { error: 'No pending approval was found for this session.' },
          { status: 409 },
        );
      }

      let resolvedHookToken: string | null = null;
      let lastResumeError: unknown = null;

      for (const hookToken of candidateHookTokens) {
        try {
          await resumeToolApproval(hookToken, {
            approved: input.action === 'approve',
            comment,
            toolCallId,
          });
          resolvedHookToken = hookToken;
          break;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (!message.toLowerCase().includes('hook not found')) {
            throw error;
          }
          lastResumeError = error;
        }
      }

      if (!resolvedHookToken) {
        throw (
          lastResumeError ??
          new Error('No matching approval hook was found for this tool call.')
        );
      }

      await updateSession(id, {
        metadata: {
          ...(session.metadata ?? {}),
          latestApproval: {
            ...(latestApproval ?? {}),
            toolCallId,
            hookToken: resolvedHookToken,
            toolName:
              runtime.approval.toolName ?? latestApproval?.toolName ?? null,
            status: input.action === 'approve' ? 'approved' : 'rejected',
            comment: comment ?? null,
            requestedAt:
              runtime.approval.requestedAt ??
              latestApproval?.requestedAt ??
              null,
            respondedAt: nowIso(),
          },
        },
      });

      logger.info('approval:responded', {
        sessionId: id,
        toolCallId,
        action: input.action,
      });
    }

    const nextRuntime = await getSessionRuntime(id);
    return Response.json({
      ok: true,
      runtime: nextRuntime,
    });
  } catch (error) {
    logger.error('control:failed', {
      sessionId: id,
      target: input.target,
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Control action failed.',
      },
      { status: 500 },
    );
  }
}
