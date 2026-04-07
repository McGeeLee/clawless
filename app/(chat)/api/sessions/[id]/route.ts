import { deleteSession, getSession } from '@/lib/core/db/chat';
import { listScheduledTasksBySessionId } from '@/lib/core/db/scheduled';
import { stopSessionSandbox } from '@/lib/core/sandbox';
import { createLogger } from '@/lib/utils/logger';
import { getRun } from 'workflow/api';

const logger = createLogger('api.sessions');

async function cancelRun(runId: string | null | undefined, scope: string) {
  if (!runId) {
    return;
  }

  try {
    await getRun(runId).cancel();
  } catch (error) {
    logger.warn(`${scope}:cancel_failed`, {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession(id);

  if (!session) {
    return Response.json({ error: 'Session not found.' }, { status: 404 });
  }

  await cancelRun(session.workflowRunId, 'workflow');

  if (session.sandboxId) {
    try {
      await stopSessionSandbox(id);
    } catch (error) {
      logger.warn('sandbox:stop_failed', {
        sessionId: id,
        sandboxId: session.sandboxId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const scheduledTasks = await listScheduledTasksBySessionId(id);
  await Promise.all(
    scheduledTasks.map((task) =>
      cancelRun(task.scheduleWorkflowRunId, 'scheduled_task'),
    ),
  );

  await deleteSession(id);

  return Response.json({ success: true });
}
