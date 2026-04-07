'use client';

import { useConfigContext } from '@/components/config/config-provider';

export function useConfigDraft() {
  return useConfigContext();
}
