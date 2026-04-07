import { generateUUID } from '@/lib/utils';
import type { WorkflowUIMessage } from '@/types/workflow';
import { createUIMessageStream } from 'ai';

export function createStaticAssistantStream(text: string) {
  return createUIMessageStream<WorkflowUIMessage>({
    execute: ({ writer }) => {
      const messageId = generateUUID();
      writer.write({ type: 'start', messageId });
      writer.write({ type: 'text-start', id: messageId });
      if (text.length > 0) {
        writer.write({ type: 'text-delta', id: messageId, delta: text });
      }
      writer.write({ type: 'text-end', id: messageId });
      writer.write({ type: 'finish', finishReason: 'stop' });
    },
  });
}
