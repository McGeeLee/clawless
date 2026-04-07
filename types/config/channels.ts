import { z } from 'zod';

/**
 * Chat SDK Adapter
 * https://chat-sdk.dev/docs/adapters
 *
 * Supported Adapters: Slack, Teams, Google Chat, Telegram
 * Each adapter is initialized with environment variables or configuration parameters and receives messages through webhooks.
 */

/**
 * Common base adapter configuration
 */
const baseAdapterConfigSchema = z.object({
  /** Whether this adapter is enabled */
  enabled: z.boolean().default(false),
  /** Author user IDs allowed to enter the main chat flow */
  allowed_author_ids: z.array(z.string().trim().min(1)).optional(),
});

/**
 * Slack adapter configuration
 * @see https://chat-sdk.dev/docs/adapters/slack
 */
export const slackAdapterConfigSchema = baseAdapterConfigSchema.extend({
  /** Slack Bot Token (xoxb-...) - single-workspace mode */
  bot_token: z.string().optional(),
  /** Slack Signing Secret - webhook signature verification */
  signing_secret: z.string().optional(),
  /** Slack Client ID - multi-workspace OAuth mode */
  client_id: z.string().optional(),
  /** Slack Client Secret - multi-workspace OAuth mode */
  client_secret: z.string().optional(),
  /** Encryption key (AES-256-GCM) */
  encryption_key: z.string().optional(),
});

export type SlackAdapterConfig = z.infer<typeof slackAdapterConfigSchema>;

/**
 * Microsoft Teams adapter configuration
 * @see https://chat-sdk.dev/docs/adapters/teams
 */
export const teamsAdapterConfigSchema = baseAdapterConfigSchema.extend({
  /** Azure Bot App ID */
  app_id: z.string().optional(),
  /** Azure Bot App Password */
  app_password: z.string().optional(),
});

export type TeamsAdapterConfig = z.infer<typeof teamsAdapterConfigSchema>;

/**
 * Google Chat adapter configuration
 * @see https://chat-sdk.dev/docs/adapters/gchat
 */
export const gchatAdapterConfigSchema = baseAdapterConfigSchema.extend({
  /** Google Cloud project ID */
  project_id: z.string().optional(),
  /** Service account credentials JSON */
  credentials_json: z.string().optional(),
});

export type GChatAdapterConfig = z.infer<typeof gchatAdapterConfigSchema>;

/**
 * Telegram adapter configuration
 * @see https://chat-sdk.dev/docs/adapters/telegram
 */
export const telegramAdapterConfigSchema = baseAdapterConfigSchema.extend({
  /** Telegram Bot Token */
  bot_token: z.string().optional(),
  /** Webhook Secret Token */
  secret_token: z.string().optional(),
  /** Bot username (used for mention detection) */
  bot_username: z.string().optional(),
  /** Custom API base URL (used when self-hosting an API gateway) */
  api_base_url: z.string().optional(),
});

export type TelegramAdapterConfig = z.infer<typeof telegramAdapterConfigSchema>;

/**
 * Aggregate configuration schema for all channels/adapters
 * Aligned with the Chat SDK Adapter system
 */
export const channelsConfigSchema = z.object({
  /** Slack adapter configuration */
  slack: slackAdapterConfigSchema.optional(),
  /** Microsoft Teams adapter configuration */
  teams: teamsAdapterConfigSchema.optional(),
  /** Google Chat adapter configuration */
  gchat: gchatAdapterConfigSchema.optional(),
  /** Telegram adapter configuration */
  telegram: telegramAdapterConfigSchema.optional(),
});

export type ChannelsConfig = z.infer<typeof channelsConfigSchema>;

/**
 * Supported adapter names
 */
export const ADAPTER_NAMES = ['slack', 'teams', 'gchat', 'telegram'] as const;

export type AdapterName = (typeof ADAPTER_NAMES)[number];
