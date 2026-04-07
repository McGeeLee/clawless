import {
  deleteScheduledTask,
  getScheduledTask,
  updateScheduledTask,
} from '@/lib/core/db/scheduled';
import { createLogger } from '@/lib/utils/logger';
import { scheduledTaskWorkflow } from '@/lib/workflow/scheduled';
import {
  computeNextDailyRunAt,
  getDefaultScheduleTimezone,
  parseDelayTarget,
  validateTimezone,
} from '@/lib/workflow/scheduled/utils';
import type { NextRequest } from 'next/server';
import { getRun, start } from 'workflow/api';
import { z } from 'zod';

const baseTaskSchema = z.object({
  title: z.string().trim().min(1).nullable().optional(),
  prompt: z.string().trim().min(1),
  active: z.boolean().default(true),
});

const delayTaskSchema = baseTaskSchema.extend({
  type: z.literal('delay'),
  runAt: z.iso.datetime(),
});

const dailyTaskSchema = baseTaskSchema.extend({
  type: z.literal('daily'),
  dailyTime: z.string().trim().min(1),
  timezone: z.string().trim().min(1).optional(),
});

const updateTaskSchema = z.discriminatedUnion('type', [
  delayTaskSchema,
  dailyTaskSchema,
]);

const logger = createLogger('api.schedules');

async function cancelScheduleRun(runId: string | null | undefined) {
  if (!runId) {
    return;
  }

  try {
    await getRun(runId).cancel();
  } catch (error) {
    logger.warn('schedule:cancel_run_failed', {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await getScheduledTask(id);

  if (!existing) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  const parsed = updateTaskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const now = new Date();
  const normalized =
    input.type === 'delay'
      ? {
          type: 'delay' as const,
          timezone: null,
          dailyTime: null,
          nextRunAt: parseDelayTarget({
            runAt: input.runAt,
            now,
          }),
          metadata: {
            runAt: input.runAt,
          },
        }
      : {
          type: 'daily' as const,
          timezone: validateTimezone(
            input.timezone ?? getDefaultScheduleTimezone(),
          ),
          dailyTime: input.dailyTime,
          nextRunAt: computeNextDailyRunAt({
            dailyTime: input.dailyTime,
            timeZone: input.timezone ?? getDefaultScheduleTimezone(),
            now,
          }),
          metadata: {
            timezone: input.timezone ?? getDefaultScheduleTimezone(),
            dailyTime: input.dailyTime,
          },
        };

  await cancelScheduleRun(existing.scheduleWorkflowRunId);

  await updateScheduledTask(id, {
    type: normalized.type,
    title: input.title ?? null,
    prompt: input.prompt,
    timezone: normalized.timezone,
    dailyTime: normalized.dailyTime,
    nextRunAt: normalized.nextRunAt,
    active: input.active,
    metadata: normalized.metadata,
    scheduleWorkflowRunId: null,
  });

  if (input.active) {
    const run = await start(scheduledTaskWorkflow, [id]);
    await updateScheduledTask(id, {
      scheduleWorkflowRunId: run.runId,
    });
  }

  const task = await getScheduledTask(id);
  return Response.json({ task });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await getScheduledTask(id);

  if (!existing) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  await cancelScheduleRun(existing.scheduleWorkflowRunId);
  await deleteScheduledTask(id);

  return Response.json({ success: true });
}
