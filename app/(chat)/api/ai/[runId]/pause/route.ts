import { getSessionByWorkflowRunId } from '@/lib/core/db/chat';
import { createLogger } from '@/lib/utils/logger';
import { pauseWorkflow } from '@/lib/workflow/agent/dispatch';

const logger = createLogger('api.ai.run.pause');

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const session = await getSessionByWorkflowRunId(runId);

  if (!session) {
    return Response.json({ error: 'Run not found.' }, { status: 404 });
  }

  await pauseWorkflow(runId);
  logger.info('pause:success', {
    runId,
    sessionId: session.id,
  });

  return Response.json({
    ok: true,
    sessionId: session.id,
    runId,
  });
}
