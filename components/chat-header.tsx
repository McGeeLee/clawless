'use client';

import { useRouter } from 'next/navigation';
import { memo } from 'react';

import { Button } from '@/components/ui/button';
import { PlusIcon } from './icons';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type ChatHeaderSession = {
  title: string | null;
  channel: string;
  externalThreadId: string | null;
};

function PureChatHeader({
  session,
}: {
  session?: ChatHeaderSession | null;
}) {
  const router = useRouter();
  const sessionDetails = session
    ? [
        {
          label: 'Channel',
          value: session.channel,
          valueClassName: 'text-foreground',
        },
        {
          label: 'External Thread',
          value: session.externalThreadId ?? 'N/A',
          valueClassName: 'break-all font-mono text-foreground',
        },
      ]
    : [];

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 px-2 py-2 backdrop-blur md:px-3">
      <div className="flex items-start gap-2">
        {session ? (
          <div className="min-w-0 flex-1">
            <h1 className="min-w-0 truncate text-sm font-semibold text-foreground">
              {session.title ?? 'Untitled Session'}
            </h1>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {sessionDetails.map(({ label, value, valueClassName }) => (
                <span
                  key={label}
                  className="inline-flex w-fit max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 leading-5"
                >
                  <span className="shrink-0 whitespace-nowrap text-muted-foreground/80">
                    {label}
                  </span>
                  <span className={`min-w-0 ${valueClassName}`}>{value}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="ml-auto shrink-0 px-2 md:h-fit"
              aria-label="New chat"
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
            >
              <PlusIcon />
              <span className="hidden md:inline">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader);
