import type { WorkflowUIMessage } from '@/types/workflow';
import { type PersistedMessageRecord, toUIMessage } from './message-utils';

export function deserializePersistedMessages(
  rows: PersistedMessageRecord[],
): WorkflowUIMessage[] {
  return rows
    .map((row) => toUIMessage(row))
    .filter((message): message is WorkflowUIMessage => message !== null);
}
