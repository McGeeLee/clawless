import { isValidBotSecret } from '@/lib/bot/webhook';
import { deliverScheduledTask } from '@/lib/workflow/scheduled/dispatch';
import { z } from 'zod';

const bodySchema = z.object({
  taskId: z.uuid(),
  scheduledFor: z.iso.datetime().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;
  if (!isValidBotSecret(secret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = bodySchema.parse(await request.json());
  const result = await deliverScheduledTask(body);

  return Response.json({
    ok: true,
    ...result,
  });
}
