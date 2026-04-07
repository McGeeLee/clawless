import { getConfig } from '@/lib/core/kv/config';
import { getBuildInToolCatalog } from '@/lib/workflow/agent/tools';
import { toolCatalogResponseSchema } from '@/types/config/tools';

export async function GET() {
  const config = await getConfig();
  const catalog = getBuildInToolCatalog(config);

  return Response.json(toolCatalogResponseSchema.parse(catalog));
}
