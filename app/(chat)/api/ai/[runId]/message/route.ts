import { createLogger } from '@/lib/utils/logger';
import { resumeWithMessage } from '@/lib/workflow/agent/dispatch';
import { chatHookPayloadSchema } from '@/types/workflow';

const logger = createLogger('api.ai.run.message');

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const payload = chatHookPayloadSchema.parse(await request.json());
  await resumeWithMessage(runId, payload);

  logger.info('message:queued', {
    runId,
    type: payload.type,
  });

  return Response.json({ ok: true });
}
