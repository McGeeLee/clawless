'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { MAX_MODEL_SUGGESTIONS, normalizeLower } from './models-dev';

type FloatingSuggestionPosition = {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
};

export function SuggestionInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions,
  onSelect,
  onBlurCommit,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions: string[];
  onSelect?: (value: string) => void;
  onBlurCommit?: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [floatingPosition, setFloatingPosition] =
    useState<FloatingSuggestionPosition | null>(null);
  const normalizedValue = normalizeLower(value);
  const filteredSuggestions = useMemo(
    () =>
      suggestions
        .filter((item) => normalizeLower(item).startsWith(normalizedValue))
        .slice(0, MAX_MODEL_SUGGESTIONS),
    [suggestions, normalizedValue],
  );

  useEffect(() => {
    if (!isOpen || !filteredSuggestions.length) {
      setFloatingPosition(null);
      return;
    }

    const updateFloatingPosition = () => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;
      const gap = 4;
      const preferredHeight = 224;
      const width = Math.max(
        0,
        Math.min(rect.width, viewportWidth - margin * 2),
      );
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const renderAbove =
        spaceBelow < preferredHeight && spaceAbove > spaceBelow;
      const availableHeight = renderAbove ? spaceAbove - gap : spaceBelow;
      const maxHeight = Math.max(
        112,
        Math.min(preferredHeight, availableHeight),
      );
      const top = renderAbove
        ? Math.max(margin, rect.top - maxHeight - gap)
        : rect.bottom + gap;
      const left = Math.max(
        margin,
        Math.min(rect.left, viewportWidth - width - margin),
      );

      setFloatingPosition({
        left,
        maxHeight,
        top,
        width,
      });
    };

    updateFloatingPosition();
    window.addEventListener('resize', updateFloatingPosition);
    window.addEventListener('scroll', updateFloatingPosition, true);

    return () => {
      window.removeEventListener('resize', updateFloatingPosition);
      window.removeEventListener('scroll', updateFloatingPosition, true);
    };
  }, [filteredSuggestions, isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        autoComplete="off"
        id={id}
        placeholder={placeholder}
        value={value}
        onBlur={() => {
          onBlurCommit?.(value);
          window.setTimeout(() => setIsOpen(false), 80);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />

      {isOpen && filteredSuggestions.length > 0 && floatingPosition
        ? createPortal(
            <Card
              className="z-50 overflow-y-auto border shadow-md"
              style={{
                left: floatingPosition.left,
                maxHeight: floatingPosition.maxHeight,
                position: 'fixed',
                top: floatingPosition.top,
                width: floatingPosition.width,
              }}
            >
              <CardContent className="p-1">
                {filteredSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    className="h-auto w-full justify-start px-2 py-1.5 text-left"
                    size="sm"
                    type="button"
                    variant="ghost"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onChange(suggestion);
                      onSelect?.(suggestion);
                      setIsOpen(false);
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </CardContent>
            </Card>,
            document.body,
          )
        : null}
    </div>
  );
}
