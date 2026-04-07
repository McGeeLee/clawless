import { resolveLanguageModel } from '@/lib/ai';
import { modelMessagesToPrompt } from '@/lib/chat/message-utils';
import type { AppConfig } from '@/types/config';
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import { type ModelMessage, generateText } from 'ai';
import {
  DEFAULT_SLIDING_WINDOW_ROUNDS,
  DEFAULT_SUMMARY_PROMPT,
} from '../config';
import {
  buildCompressionConversationMessages,
  createSummaryModelMessage,
} from '../context';
import type { CompressResult } from '../types';

function formatConversation(messages: ModelMessage[]): string {
  return messages
    .map((message) => {
      const text =
        typeof message.content === 'string'
          ? message.content
          : message.content
              .flatMap((part) =>
                'text' in part && typeof part.text === 'string'
                  ? [part.text]
                  : [],
              )
              .join('');
      return `[${message.role}] ${text}`;
    })
    .join('\n\n');
}

function keepSlidingWindow(
  messages: ModelMessage[],
  rounds: number,
): ModelMessage[] {
  return messages
    .filter(
      (message) => message.role === 'user' || message.role === 'assistant',
    )
    .slice(Math.max(0, messages.length - rounds));
}

export async function generateCompressedContext(input: {
  sessionId: string;
  config: AppConfig;
  slidingWindowRounds?: number;
}): Promise<CompressResult> {
  'use step';

  const modelMessages = await buildCompressionConversationMessages(
    input.sessionId,
  );
  const rounds = input.slidingWindowRounds ?? DEFAULT_SLIDING_WINDOW_ROUNDS;
  const modelId = input.config.models?.model;

  if (!modelId) {
    throw new Error('No model configured for compression.');
  }

  if (modelMessages.length === 0) {
    return {
      summaryText: '',
      compressedMessages: [],
    };
  }

  const result = await generateText({
    model: resolveLanguageModel(modelId, input.config),
    prompt: `${DEFAULT_SUMMARY_PROMPT}
    
${formatConversation(modelMessages)}`,
    maxOutputTokens: Math.min(
      input.config.models?.max_output_tokens ?? 1024,
      1024,
    ),
  });

  const summaryText = result.text.trim();
  const recentMessages = keepSlidingWindow(modelMessages, rounds);
  const compressedMessages: LanguageModelV3Prompt = modelMessagesToPrompt([
    createSummaryModelMessage(summaryText),
    ...recentMessages,
  ]);

  return {
    summaryText,
    compressedMessages,
  };
}
