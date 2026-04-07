import { z } from 'zod';

export const sessionMemorySummarySchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  content: z.string(),
  summaryVersion: z.number().int().min(1),
  isCurrent: z.boolean(),
  createdAt: z.string(),
});

export type SessionMemorySummary = z.infer<typeof sessionMemorySummarySchema>;

export const sessionMemoryQuerySchema = z.object({
  sessionId: z.string().uuid(),
});

export type SessionMemoryQuery = z.infer<typeof sessionMemoryQuerySchema>;
