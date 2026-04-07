import { getConfig } from '@/lib/core/kv/config';
import { getRuntimeHealthSnapshot } from '@/lib/utils/runtime-health';

export async function GET() {
  return Response.json({
    config: await getConfig(),
    runtimeHealth: getRuntimeHealthSnapshot(),
  });
}
