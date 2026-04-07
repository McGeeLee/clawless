import {
  deleteLongTermMemory,
  getLongTermMemory,
  updateLongTermMemory,
} from '@/lib/memory';
import { updateLongTermMemorySchema } from '@/types/memory';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const memory = await getLongTermMemory(id);

  if (!memory) {
    return Response.json({ error: 'Memory not found' }, { status: 404 });
  }

  return Response.json({ memory });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateLongTermMemorySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await updateLongTermMemory({
    id,
    content: parsed.data.content,
  });

  if (!result) {
    return Response.json({ error: 'Memory not found' }, { status: 404 });
  }

  return Response.json(result);
}

export async function DELETE(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await deleteLongTermMemory(id);

  if (!deleted) {
    return Response.json({ error: 'Memory not found' }, { status: 404 });
  }

  return Response.json({ success: true });
}
