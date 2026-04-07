import { z } from 'zod';

export const autonomyLevelEnum = z.enum([
  'supervised', // Supervised autonomy; critical actions require confirmation.
  'full', // Fully autonomous.
]);

export type AutonomyLevel = z.infer<typeof autonomyLevelEnum>;

/**
 * Autonomy configuration schema.
 */
export const autonomyConfigSchema = z.object({
  /** Autonomy level. */
  level: autonomyLevelEnum.default('supervised'),
  /** Max number of actions allowed per conversation. */
  max_steps: z
    .number()
    .int()
    .min(0, 'max_steps cannot be negative')
    .default(20),
});

export type AutonomyConfig = z.infer<typeof autonomyConfigSchema>;
