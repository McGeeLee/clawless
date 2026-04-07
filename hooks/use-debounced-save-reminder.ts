'use client';

import { useDebouncedValue } from './use-debounced-value';

export function useDebouncedSaveReminder(
  revision: number,
  isDirty: boolean,
  delay = 900,
) {
  const debouncedRevision = useDebouncedValue(revision, delay);

  return isDirty && debouncedRevision === revision;
}
