import {
  listBuiltinMemorySections,
  setBuiltinMemorySection,
} from '@/lib/memory';
import { updateBuiltinMemorySchema } from '@/types/memory';

export async function GET() {
  const sections = await listBuiltinMemorySections();
  return Response.json({ sections });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = updateBuiltinMemorySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await setBuiltinMemorySection(
    parsed.data.key,
    parsed.data.content,
  );

  return Response.json(result);
}
