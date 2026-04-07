import {
  getAppBaseUrl,
  getBotAuthSecret,
  getWebhookCallbackUrl,
} from '@/lib/bot/webhook';
import { ADAPTER_NAMES } from '@/types/config/channels';

export async function GET(_request: Request) {
  const urls = Object.fromEntries(
    ADAPTER_NAMES.map((adapter) => [adapter, getWebhookCallbackUrl(adapter)]),
  );

  return Response.json({
    authSecretConfigured: Boolean(getBotAuthSecret()),
    baseUrl: getAppBaseUrl(),
    urls,
  });
}
