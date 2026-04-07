import { defineHook } from 'workflow';
import { z } from 'zod';

export const toolApprovalPayloadSchema = z.object({
  approved: z.boolean(),
  comment: z.string().optional(),
});

export const approvalHookBuilder = defineHook({
  schema: toolApprovalPayloadSchema,
});
