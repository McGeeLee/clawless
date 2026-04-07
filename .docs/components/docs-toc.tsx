'use client';

import { useState } from 'react';

import { type DocSummary } from '../lib/docs';
import { TransitionLink } from './transition-link';

type DocsTocProps = {
  docs: DocSummary[];
  currentHref: string;
};

export function DocsToc({ docs, currentHref }: DocsTocProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside className={`sidebar${isOpen ? ' mobile-open' : ''}`}>
      <div className="sidebar-header">
        <p className="sidebar-title">TOC</p>
        <button
          type="button"
          className="sidebar-toggle"
          aria-expanded={isOpen}
          aria-controls="docs-toc-nav"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span>Sections</span>
          <span className="sidebar-toggle-icon" aria-hidden="true">
            ▾
          </span>
        </button>
      </div>

      <div className="sidebar-panel">
        <nav className="nav" id="docs-toc-nav" aria-label="Documentation">
          {docs.map((doc) => (
            <TransitionLink
              key={doc.href}
              href={doc.href}
              className={`nav-item${doc.href === currentHref ? ' active' : ''}`}
            >
              <strong>{doc.title}</strong>
            </TransitionLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
