'use client';

import { useEffect, useState } from 'react';

import { SuggestionInput } from './suggestion-input';

export function DeferredProviderIdInput({
  id,
  providerKey,
  onCommit,
  suggestions,
}: {
  id?: string;
  providerKey: string;
  onCommit: (nextProviderKey: string) => void;
  suggestions: string[];
}) {
  const [localValue, setLocalValue] = useState(providerKey);

  useEffect(() => {
    setLocalValue(providerKey);
  }, [providerKey]);

  return (
    <SuggestionInput
      id={id}
      placeholder="provider id"
      suggestions={suggestions}
      value={localValue}
      onChange={setLocalValue}
      onBlurCommit={(currentValue) => {
        const nextProviderName = currentValue.trim();

        if (!nextProviderName || nextProviderName === providerKey) {
          return;
        }

        onCommit(nextProviderName);
      }}
      onSelect={(selected) => {
        if (selected && selected !== providerKey) {
          onCommit(selected);
        }
      }}
    />
  );
}
