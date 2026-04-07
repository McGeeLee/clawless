import { resolveLanguageModel } from '@/lib/ai';
import type { AppConfig } from '@/types/config';
import type { CompatibleLanguageModel } from '@workflow/ai/agent';

export function createModelResolver(config: AppConfig, modelId: string) {
  return async function resolveModel(): Promise<CompatibleLanguageModel> {
    'use step';

    return resolveLanguageModel(modelId, config) as CompatibleLanguageModel;
  };
}
