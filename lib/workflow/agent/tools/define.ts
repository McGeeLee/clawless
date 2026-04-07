import { createLogger } from '@/lib/utils/logger';
import type { AppConfig } from '@/types/config';
import type {
  BuiltInToolId,
  ToolCatalogItem,
  ToolEntryConfig,
} from '@/types/config/tools';
import type { WorkflowUIMessageChunk } from '@/types/workflow';
import type { Tool, ToolSet } from 'ai';

type MaybePromise<T> = T | Promise<T>;
type FactoryResult = Record<string, Tool | null> | null;
type BuildInToolResolution = {
  entry: ToolEntryConfig;
  mergedConfig: Record<string, string>;
  missingRequiredConfig: string[];
};

type BuildInToolDescriptor = {
  id: BuiltInToolId;
  description: string;
  requiredConfig: readonly string[];
  optionalConfig: readonly string[];
};

export type BuildInToolDefinition = BuildInToolDescriptor & {
  factory: (
    config: Record<string, string>,
    context: BuildInToolFactoryContext,
  ) => MaybePromise<FactoryResult>;
  toCatalogItem: (appConfig: AppConfig) => ToolCatalogItem;
  register: (
    appConfig: AppConfig,
    context: BuildInToolFactoryContext,
  ) => MaybePromise<ToolSet | null>;
};

export type BuildAgentToolsOptions = {
  runId?: string;
  agentName?: string;
  // true for parent-agent tool sets; false for nested sub-agent tool sets.
  allowDelegation?: boolean;
  writable?: WritableStream<WorkflowUIMessageChunk>;
};

export type BuildInToolFactoryContext = {
  sessionId: string;
  runId: string;
  appConfig: AppConfig;
  agentName: string;
  // Mirrors BuildAgentToolsOptions.allowDelegation.
  allowDelegation: boolean;
  writable?: WritableStream<WorkflowUIMessageChunk>;
  buildNestedTools: (options?: BuildAgentToolsOptions) => Promise<ToolSet>;
};

const DEFAULT_TOOL_ENTRY_CONFIG: ToolEntryConfig = {
  enabled: true,
  config: {},
};

const logger = createLogger('workflow.agent.tools.execute');

type ToolExecutionLogContext = {
  provider: 'builtin' | 'mcp';
  toolId: string;
  toolName: string;
  sessionId?: string;
  agentName?: string;
  serverName?: string;
};

function getArgKeys(input: unknown): string[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return [];
  }

  return Object.keys(input).sort();
}

function getResultShape(value: unknown): string {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCause(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  if (error.cause instanceof Error) {
    return error.cause.message;
  }

  if (typeof error.cause === 'string') {
    return error.cause;
  }

  return undefined;
}

export function withToolExecutionLogger(
  tool: ToolSet[string],
  context: ToolExecutionLogContext,
): ToolSet[string] {
  const execute = tool.execute;
  if (!execute) {
    return tool;
  }

  return {
    ...tool,
    execute: async (input, options) => {
      const startedAt = Date.now();
      const argKeys = getArgKeys(input);
      const toolCallId = options?.toolCallId;

      logger.info('execute:start', {
        ...context,
        argKeys,
        toolCallId,
      });

      try {
        const result = await execute(input, options);

        logger.info('execute:success', {
          ...context,
          argKeys,
          toolCallId,
          elapsedMs: Date.now() - startedAt,
          resultShape: getResultShape(result),
        });

        return result;
      } catch (error) {
        logger.error('execute:failed', {
          ...context,
          argKeys,
          toolCallId,
          elapsedMs: Date.now() - startedAt,
          errorName: getErrorName(error),
          error: getErrorMessage(error),
          errorCause: getErrorCause(error),
        });
        throw error;
      }
    },
  };
}

function hasConfigValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getToolEntryConfig(
  appConfig: AppConfig,
  id: BuiltInToolId,
): ToolEntryConfig {
  return appConfig.tools?.[id] ?? DEFAULT_TOOL_ENTRY_CONFIG;
}

function resolveBuildInTool(
  appConfig: AppConfig,
  definition: BuildInToolDescriptor,
) {
  const entry = getToolEntryConfig(appConfig, definition.id);
  const mergedConfig = { ...entry.config };
  const configKeys = new Set([
    ...definition.requiredConfig,
    ...definition.optionalConfig,
  ]);

  for (const key of configKeys) {
    if (hasConfigValue(mergedConfig[key])) {
      continue;
    }

    const envValue = process.env[key];
    if (hasConfigValue(envValue)) {
      mergedConfig[key] = envValue;
    }
  }

  const missingRequiredConfig = definition.requiredConfig.filter(
    (key) => !hasConfigValue(mergedConfig[key]),
  );

  return {
    entry,
    mergedConfig,
    missingRequiredConfig,
  } satisfies BuildInToolResolution;
}

export function defineBuildInTool(config: {
  id: BuiltInToolId;
  description: string;
  requiredConfig?: readonly string[];
  optionalConfig?: readonly string[];
  factory: (
    config: Record<string, string>,
    context: BuildInToolFactoryContext,
  ) => MaybePromise<FactoryResult>;
}): BuildInToolDefinition {
  const {
    id,
    description,
    requiredConfig = [],
    optionalConfig = [],
    factory,
  } = config;

  const definition: BuildInToolDescriptor = {
    id,
    description,
    requiredConfig,
    optionalConfig,
  };

  return {
    ...definition,
    factory,
    toCatalogItem: (appConfig) => {
      const { entry, missingRequiredConfig } = resolveBuildInTool(
        appConfig,
        definition,
      );

      return {
        id,
        description,
        requiredConfig: [...requiredConfig],
        optionalConfig: [...optionalConfig],
        missingRequiredConfig,
        canEnable: missingRequiredConfig.length === 0,
        enabled: entry.enabled,
        config: entry.config,
      };
    },
    register: async (appConfig, context) => {
      const { entry, mergedConfig, missingRequiredConfig } = resolveBuildInTool(
        appConfig,
        definition,
      );

      if (!entry.enabled || missingRequiredConfig.length > 0) {
        return null;
      }

      const created = await factory(mergedConfig, context);
      if (!created) {
        return null;
      }

      const tools = Object.entries(created).reduce<ToolSet>(
        (allTools, entry) => {
          const [toolName, tool] = entry;
          if (tool) {
            allTools[toolName] = withToolExecutionLogger(tool, {
              provider: 'builtin',
              toolId: id,
              toolName,
              sessionId: context.sessionId,
              agentName: context.agentName,
            });
          }

          return allTools;
        },
        {},
      );

      return Object.keys(tools).length > 0 ? tools : null;
    },
  };
}
