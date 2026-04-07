import { createLogger } from '@/lib/utils/logger';
import type { AppConfig } from '@/types/config';
import { embed } from 'ai';
import { getEmbeddingModel, getLanguageModel, getProvider } from './providers';

/**
 * parse "provider/model-id" format
 */
export function parseProviderScopedModelId(modelId: string) {
  const logger = createLogger('ai.model');
  const separatorIndex = modelId.indexOf('/');

  if (separatorIndex <= 0 || separatorIndex === modelId.length - 1) {
    logger.warn('parse:invalid_model_id', { modelId });
    throw new Error(
      `Invalid model ID: "${modelId}". Expected format: "provider/model-id"`,
    );
  }

  return {
    providerName: modelId.slice(0, separatorIndex),
    providerModelId: modelId.slice(separatorIndex + 1),
  };
}

export function resolveLanguageModel(modelId: string, config: AppConfig) {
  const logger = createLogger('ai.model');
  const { providerName, providerModelId } = parseProviderScopedModelId(modelId);

  const providerConfig = config.models?.providers?.[providerName];
  if (!providerConfig) {
    logger.error('resolve:provider_not_found', {
      modelId,
      providerName,
      configuredProviders: Object.keys(config.models?.providers ?? {}),
    });
    throw new Error(`Provider "${providerName}" not found in configuration`);
  }

  logger.info('resolve:language_model', {
    modelId,
    providerName,
    providerModelId,
    providerFormat: providerConfig.format,
  });

  const provider = getProvider({
    provider: providerName,
    format: providerConfig.format,
    api_key: providerConfig.api_key,
    base_url: providerConfig.base_url,
    headers: providerConfig.headers,
  });

  return getLanguageModel(providerModelId, provider);
}

export function resolveEmbeddingModel(modelId: string, config: AppConfig) {
  const logger = createLogger('ai.model');
  const { providerName, providerModelId } = parseProviderScopedModelId(modelId);

  const providerConfig = config.models?.providers?.[providerName];
  if (!providerConfig) {
    logger.error('resolve:embedding_provider_not_found', {
      modelId,
      providerName,
      configuredProviders: Object.keys(config.models?.providers ?? {}),
    });
    throw new Error(`Provider "${providerName}" not found in configuration`);
  }

  logger.info('resolve:embedding_model', {
    modelId,
    providerName,
    providerModelId,
    providerFormat: providerConfig.format,
  });

  const provider = getProvider({
    provider: providerName,
    format: providerConfig.format,
    api_key: providerConfig.api_key,
    base_url: providerConfig.base_url,
    headers: providerConfig.headers,
  });

  return getEmbeddingModel(providerModelId, provider);
}

export async function generateEmbedding(
  value: string,
  modelId: string,
  config: AppConfig,
) {
  const { embedding } = await embed({
    model: resolveEmbeddingModel(modelId, config),
    value,
  });

  return {
    embedding,
    embeddingModel: modelId,
    embeddingDimensions: embedding.length,
  };
}
