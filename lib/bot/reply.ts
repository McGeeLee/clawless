import { getConfig } from '@/lib/core/kv/config';
import { createLogger } from '@/lib/utils/logger';
import type { AppConfig } from '@/types/config';
import {
  ADAPTER_NAMES,
  type AdapterName,
  type ChannelsConfig,
} from '@/types/config/channels';
import type { ChatSource } from '@/types/workflow';
import { createBaseBotFromConfig, getBaseBot } from './core';

const logger = createLogger('bot.reply');

function normalizeAllowedUserIds(value?: string[]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function getScheduledBroadcastTargets(channels?: ChannelsConfig) {
  const targets: Array<{ adapter: AdapterName; userId: string }> = [];

  for (const adapter of ADAPTER_NAMES) {
    const adapterConfig = channels?.[adapter];
    if (!adapterConfig?.enabled) {
      continue;
    }

    const userIds = normalizeAllowedUserIds(adapterConfig.allowed_author_ids);
    for (const userId of userIds) {
      targets.push({
        adapter,
        userId,
      });
    }
  }

  return targets;
}

async function sendScheduledDirectMessage(input: {
  bot: ReturnType<typeof createBaseBotFromConfig>;
  adapter: AdapterName;
  userId: string;
  text: string;
}): Promise<boolean> {
  try {
    const targetAdapter = input.bot.getAdapter(input.adapter);
    if (!targetAdapter.openDM) {
      throw new Error(
        `Adapter "${input.adapter}" does not support direct messages`,
      );
    }

    const dmThreadId = await targetAdapter.openDM(input.userId);
    await targetAdapter.postMessage(dmThreadId, {
      markdown: input.text,
    });
    return true;
  } catch (error) {
    logger.warn('reply:scheduled_dm_failed', {
      adapter: input.adapter,
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function sendScheduledSourceReply(
  text: string,
  config: AppConfig,
): Promise<boolean> {
  const targets = getScheduledBroadcastTargets(config.channels);
  if (targets.length === 0) {
    return false;
  }

  const bot = createBaseBotFromConfig(config);
  let deliveredCount = 0;

  for (const target of targets) {
    const sent = await sendScheduledDirectMessage({
      bot,
      adapter: target.adapter,
      userId: target.userId,
      text,
    });

    if (sent) {
      deliveredCount += 1;
    }
  }

  logger.info('reply:scheduled_broadcast', {
    targetCount: targets.length,
    deliveredCount,
  });

  return deliveredCount > 0;
}

export async function sendAdapterSourceReply(
  source: ChatSource,
  text: string,
): Promise<boolean> {
  const content = text.trim();
  if (source.type !== 'im' || content.length === 0) {
    return false;
  }

  try {
    const bot = await getBaseBot();
    const adapter = bot.getAdapter(source.adapter);
    await adapter.postMessage(source.threadId, {
      markdown: content,
    });
    return true;
  } catch (error) {
    logger.warn('reply:failed', {
      adapter: source.adapter,
      threadId: source.threadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function sendRoutedSourceReply(
  source: ChatSource,
  text: string,
): Promise<boolean> {
  const content = text.trim();
  if (content.length === 0) {
    return false;
  }

  if (source.type === 'scheduled') {
    const config = await getConfig();
    return sendScheduledSourceReply(content, config);
  }

  return sendAdapterSourceReply(source, content);
}
