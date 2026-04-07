import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import type { LanguageModelUsage, StepResult, ToolSet } from 'ai';

export type TokenUsageBucket =
  | number
  | {
      total?: number;
      noCache?: number;
      cacheRead?: number;
      cacheWrite?: number;
      text?: number;
      reasoning?: number;
    };

/**
 * Token Usage record for a workflow run or a step.
 */
export interface TokenUsage extends Record<string, unknown> {
  inputTokens?: TokenUsageBucket;
  outputTokens?: TokenUsageBucket;
  totalTokens?: number;
}

export function getTokenUsageTotal(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return 0;
  }

  const total = (value as { total?: unknown }).total;
  return typeof total === 'number' && Number.isFinite(total) ? total : 0;
}

/**
 * Aggregate token usage from multiple steps into a single TokenUsage record.
 */
export function aggregateTokenUsage(steps: StepResult<ToolSet>[]): TokenUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  for (const step of steps) {
    const usage: LanguageModelUsage | undefined = step.usage;
    if (usage) {
      inputTokens += getTokenUsageTotal(usage.inputTokens);
      outputTokens += getTokenUsageTotal(usage.outputTokens);
      totalTokens += usage.totalTokens ?? 0;
    }
  }

  return { inputTokens, outputTokens, totalTokens };
}

/**
 * Result of compressing conversation context, including the generated summary and the compressed messages in a format suitable for preparing the next step's input.
 */
export interface CompressResult {
  summaryText: string;
  compressedMessages: LanguageModelV3Prompt;
}
