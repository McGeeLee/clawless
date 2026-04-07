import { db, schema } from '@/lib/core/db';
import { createLogger } from '@/lib/utils/logger';
import { eq } from 'drizzle-orm';

const logger = createLogger('db.scheduled');

export type ScheduledTaskType = 'delay' | 'daily';

type ScheduledTaskMetadata = Record<string, unknown> | undefined;

export async function createScheduledTask(input: {
  sessionId: string;
  type: ScheduledTaskType;
  title?: string;
  prompt: string;
  timezone?: string;
  dailyTime?: string;
  nextRunAt?: Date | null;
  metadata?: ScheduledTaskMetadata;
}) {
  logger.info('create:start', {
    sessionId: input.sessionId,
    type: input.type,
  });

  const [task] = await db
    .insert(schema.scheduledTasks)
    .values({
      sessionId: input.sessionId,
      type: input.type,
      title: input.title ?? null,
      prompt: input.prompt,
      timezone: input.timezone ?? null,
      dailyTime: input.dailyTime ?? null,
      nextRunAt: input.nextRunAt ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();

  if (!task) {
    throw new Error('Failed to create scheduled task.');
  }

  logger.info('create:success', { taskId: task.id });
  return task;
}

export async function getScheduledTask(taskId: string) {
  const [task] = await db
    .select()
    .from(schema.scheduledTasks)
    .where(eq(schema.scheduledTasks.id, taskId))
    .limit(1);

  return task ?? null;
}

export async function listScheduledTasks() {
  const tasks = await db.select().from(schema.scheduledTasks);

  return tasks.sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1;
    }

    const leftNext = left.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightNext = right.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (leftNext !== rightNext) {
      return leftNext - rightNext;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

export async function listScheduledTasksBySessionId(sessionId: string) {
  return db
    .select()
    .from(schema.scheduledTasks)
    .where(eq(schema.scheduledTasks.sessionId, sessionId));
}

export async function updateScheduledTask(
  taskId: string,
  input: {
    type?: ScheduledTaskType;
    title?: string | null;
    prompt?: string;
    timezone?: string | null;
    dailyTime?: string | null;
    nextRunAt?: Date | null;
    lastTriggeredAt?: Date | null;
    lastFiredFor?: Date | null;
    scheduleWorkflowRunId?: string | null;
    lastChatRunId?: string | null;
    active?: boolean;
    metadata?: ScheduledTaskMetadata | null;
  },
) {
  logger.log('update:start', { taskId, keys: Object.keys(input) });

  await db
    .update(schema.scheduledTasks)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(schema.scheduledTasks.id, taskId));

  logger.log('update:success', { taskId });
}

export async function deleteScheduledTask(taskId: string) {
  logger.info('delete:start', { taskId });

  const [task] = await db
    .delete(schema.scheduledTasks)
    .where(eq(schema.scheduledTasks.id, taskId))
    .returning();

  logger.info('delete:success', { taskId });
  return task ?? null;
}
