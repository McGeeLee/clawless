import type { ChannelsConfig } from '@/types/config/channels';
import { createGoogleChatAdapter } from '@chat-adapter/gchat';
import { createSlackAdapter } from '@chat-adapter/slack';
import { createTeamsAdapter } from '@chat-adapter/teams';
import { createTelegramAdapter } from '@chat-adapter/telegram';

type BotAdapters = {
  gchat?: ReturnType<typeof createGoogleChatAdapter>;
  slack?: ReturnType<typeof createSlackAdapter>;
  teams?: ReturnType<typeof createTeamsAdapter>;
  telegram?: ReturnType<typeof createTelegramAdapter>;
};

export function createBotAdapters(channels?: ChannelsConfig): BotAdapters {
  const adapters: BotAdapters = {};

  if (channels?.slack?.enabled) {
    const cfg = channels.slack;
    adapters.slack = createSlackAdapter({
      ...(cfg.bot_token ? { botToken: cfg.bot_token } : {}),
      ...(cfg.signing_secret ? { signingSecret: cfg.signing_secret } : {}),
      ...(cfg.client_id ? { clientId: cfg.client_id } : {}),
      ...(cfg.client_secret ? { clientSecret: cfg.client_secret } : {}),
      ...(cfg.encryption_key ? { encryptionKey: cfg.encryption_key } : {}),
    });
  }

  if (channels?.teams?.enabled) {
    const cfg = channels.teams;
    adapters.teams = createTeamsAdapter({
      ...(cfg.app_id ? { appId: cfg.app_id } : {}),
      ...(cfg.app_password ? { appPassword: cfg.app_password } : {}),
    });
  }

  if (channels?.gchat?.enabled) {
    const cfg = channels.gchat;
    adapters.gchat = createGoogleChatAdapter({
      ...(cfg.project_id ? { projectId: cfg.project_id } : {}),
      ...(cfg.credentials_json
        ? { credentials: JSON.parse(cfg.credentials_json) }
        : {}),
    });
  }

  if (channels?.telegram?.enabled) {
    const cfg = channels.telegram;
    adapters.telegram = createTelegramAdapter({
      ...(cfg.bot_token ? { botToken: cfg.bot_token } : {}),
      ...(cfg.secret_token ? { secretToken: cfg.secret_token } : {}),
      ...(cfg.bot_username ? { userName: cfg.bot_username } : {}),
      ...(cfg.api_base_url ? { apiBaseUrl: cfg.api_base_url } : {}),
    });
  }

  return adapters;
}
