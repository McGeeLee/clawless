import { DocsShell } from '../components/docs-shell';
import { getDocBySlug } from '../lib/docs';

export default function HomePage() {
  const home = getDocBySlug([]);

  if (!home) {
    throw new Error('Missing index.md in .docs/content.');
  }

  return <DocsShell currentDoc={home} />;
}
