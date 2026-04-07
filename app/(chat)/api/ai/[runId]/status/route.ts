import { getSessionByWorkflowRunId } from '@/lib/core/db/chat';
import { getSessionRuntimeMetadata } from '@/lib/core/sandbox/runtime';
import { createLogger } from '@/lib/utils/logger';
import { getWorkflowStatus } from '@/lib/workflow/agent/dispatch';

const logger = createLogger('api.ai.run.status');

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const session = await getSessionByWorkflowRunId(runId);

  if (!session) {
    return Response.json({ error: 'Run not found.' }, { status: 404 });
  }

  const status = await getWorkflowStatus(runId);
  const metadata = getSessionRuntimeMetadata(session.metadata ?? null);

  logger.info('status:loaded', {
    runId,
    sessionId: session.id,
    status,
  });

  return Response.json({
    runId,
    sessionId: session.id,
    status,
    workflow: metadata.workflow,
    session: {
      id: session.id,
      channel: session.channel,
      model: session.model,
      totalTokens: session.totalTokens,
      source: session.metadata?.source ?? null,
    },
  });
}
