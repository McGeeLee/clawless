import type { AppConfig } from '@/types/config';

export const MAIN_AGENT_NAME = 'main';

export function getMainAgentModelId(config: AppConfig): string {
  const modelId = config.models?.model;
  if (!modelId) {
    throw new Error('No model configured for the main agent.');
  }

  return modelId;
}

export function getMainAgentTemperature(config: AppConfig): number | undefined {
  return config.models?.temperature;
}

export function getAgentModelId(config: AppConfig, agentName: string): string {
  const modelId = config.agents?.[agentName]?.model ?? config.models?.model;
  if (!modelId) {
    throw new Error(`No model configured for agent "${agentName}".`);
  }
  return modelId;
}

export function getAgentTemperature(
  config: AppConfig,
  agentName: string,
): number | undefined {
  return config.agents?.[agentName]?.temperature ?? config.models?.temperature;
}

export function getDelegatableAgentNames(
  config: AppConfig,
  currentAgentName: string,
): string[] {
  return Object.keys(config.agents ?? {}).filter(
    (agentName) => agentName !== currentAgentName,
  );
}
