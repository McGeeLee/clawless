import { createSession, updateSession } from '@/lib/core/db/chat';

export async function POST(request: Request) {
  const body = await request.json();
  const session = await createSession({
    title: body.title,
    channel: body.channel ?? 'web',
    model: body.model,
    systemPrompt: body.systemPrompt,
    userId: body.userId,
  });
  return Response.json({ id: session.id });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  if (!body.id) {
    return Response.json({ error: 'Missing session id' }, { status: 400 });
  }
  await updateSession(body.id, {
    title: body.title,
    archived: body.archived,
  });
  return Response.json({ success: true });
}
