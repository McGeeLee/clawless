import { listScheduledTasks } from '@/lib/core/db/scheduled';

function deriveDisplayStatus(
  task: Awaited<ReturnType<typeof listScheduledTasks>>[number],
) {
  const now = Date.now();
  const archived =
    task.type === 'delay' &&
    (task.lastTriggeredAt !== null ||
      (!task.active && task.nextRunAt === null) ||
      (task.nextRunAt !== null && task.nextRunAt.getTime() <= now));

  return {
    ...task,
    archived,
    displayStatus: archived ? ('archived' as const) : ('scheduled' as const),
  };
}

export async function GET() {
  const tasks = await listScheduledTasks();
  return Response.json({ tasks: tasks.map(deriveDisplayStatus) });
}
