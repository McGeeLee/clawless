import { z } from 'zod';

/**
 * MCP server configuration schema.
 */
export const mcpRemoteServerConfigSchema = z.object({
  type: z.enum(['http', 'sse']).default('http'),
  url: z.url('MCP server URL must be a valid URL'),
  headers: z.record(z.string(), z.string()).optional(),
});

export type MCPRemoteServerConfig = z.infer<typeof mcpRemoteServerConfigSchema>;

/**
 * MCP remote server map configuration schema.
 */
export const mcpRemotesServersConfigSchema = z
  .record(z.string(), mcpRemoteServerConfigSchema)
  .default({});

export type MCPRemoteServersConfig = z.infer<
  typeof mcpRemotesServersConfigSchema
>;
