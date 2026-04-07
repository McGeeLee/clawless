import { type DocPage, getDocSummaries } from '../lib/docs';
import { DocsToc } from './docs-toc';
import { MarkdownContent } from './markdown-content';
import { ThemeToggle } from './theme-toggle';

type DocsShellProps = {
  currentDoc: DocPage;
};

export function DocsShell({ currentDoc }: DocsShellProps) {
  const docs = getDocSummaries();

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-topbar">
          <img src="/clawless/icon.png" alt="Claw Less Docs" className="logo" />
          <ThemeToggle />
        </div>
        <h1>ClawLess</h1>
        <p>A serverless AI agent.</p>
      </section>

      <div className="layout">
        <DocsToc docs={docs} currentHref={currentDoc.href} />

        <article className="content">
          <header className="article-header">
            <h1>{currentDoc.title}</h1>
            <p>{currentDoc.description}</p>
          </header>
          <MarkdownContent content={currentDoc.content} />
        </article>
      </div>

      <footer>
        <span>ClawLess Team.</span>
        <span>
          Built with <a href="https://nextjs.org/">Next.js</a>.
        </span>
      </footer>
    </main>
  );
}
