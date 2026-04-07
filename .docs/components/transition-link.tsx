'use client';

import Link, { type LinkProps } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => unknown;
};

type TransitionLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
};

function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function TransitionLink({
  href,
  children,
  className,
  target,
  rel,
}: TransitionLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hrefString = typeof href === 'string' ? href : href.toString();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      isModifiedEvent(event) ||
      target === '_blank' ||
      hrefString === pathname
    ) {
      return;
    }

    event.preventDefault();

    const transitionDocument = document as ViewTransitionDocument;

    if (!transitionDocument.startViewTransition) {
      router.push(hrefString);
      return;
    }

    transitionDocument.startViewTransition(() => {
      router.push(hrefString);
    });
  }

  return (
    <Link
      href={href}
      className={className}
      target={target}
      rel={rel}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
