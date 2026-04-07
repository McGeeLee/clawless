import { getBot } from '@/lib/bot';
import { isValidBotSecret } from '@/lib/bot/webhook';
import { after } from 'next/server';

async function handleCallback(
  request: Request,
  { params }: { params: Promise<{ secret: string; adapter: string }> },
) {
  const { secret, adapter } = await params;

  if (!isValidBotSecret(secret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bot = await getBot();
  const webhookHandler = bot.webhooks[adapter];
  if (!webhookHandler) {
    return Response.json(
      { error: `Unknown adapter: ${adapter}` },
      { status: 404 },
    );
  }

  return webhookHandler(request, {
    waitUntil: (task) => after(() => task),
  });
}

export const GET = handleCallback;
export const POST = handleCallback;
