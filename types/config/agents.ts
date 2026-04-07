import { z } from 'zod';
import { aiModelConfigSchema } from './ai';

/**
 * Single agent/bot configuration schema.
 */
export const agentInstanceConfigSchema = z.object({
  /** Model configuration for this agent; overrides defaults when provided. */
  model: aiModelConfigSchema.optional(),
  /** System prompt that guides this agent's behavior. */
  system_prompt: z.string().optional(),
  /** Optional per-agent temperature override. */
  temperature: z.number().min(0).max(2).optional(),
});

export type AgentInstanceConfig = z.infer<typeof agentInstanceConfigSchema>;

/**
 * Agent registry configuration schema.
 */
export const agentConfigSchema = z.record(
  z.string().min(1, 'Agent name is required'),
  agentInstanceConfigSchema,
);

export type AgentConfig = z.infer<typeof agentConfigSchema>;
