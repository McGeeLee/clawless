import {
  assertConfigPatch,
  patchConfig,
  setConfig,
} from '@/lib/core/kv/config';
import { appConfigSchema } from '@/types/config';

export async function PATCH(request: Request) {
  const body = await request.json();
  const patch = assertConfigPatch(body);
  return Response.json(await patchConfig(patch));
}

export async function PUT(request: Request) {
  const body = await request.json();
  const config = appConfigSchema.parse(body);
  return Response.json(await setConfig(config));
}
