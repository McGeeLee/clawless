import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';

export type DocFrontmatter = {
  title: string;
  description: string;
  order?: number;
};

export type DocSummary = DocFrontmatter & {
  slug: string[];
  href: string;
};

export type DocPage = DocSummary & {
  content: string;
};

const contentDirectory = path.join(process.cwd(), 'content');

function slugToHref(slug: string[]) {
  return slug.length === 0 ? '/' : `/${slug.join('/')}`;
}

function readMarkdownFile(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);

  return {
    frontmatter: data as DocFrontmatter,
    content,
  };
}

// Sorting logic:
// 1. Pages with a negative order are sorted after all pages with a non-negative order.
// 2. Among pages with a non-negative order, they are sorted in ascending order based on the order value.
// 3. Among pages with a negative order, they are sorted in descending order based on the order value (i.e., more negative values come later).
// 4. If two pages have the same order value (including both being undefined), they are sorted alphabetically by their title.
function compareOrder(leftOrder?: number, rightOrder?: number) {
  const normalizedLeft = leftOrder ?? Number.MAX_SAFE_INTEGER;
  const normalizedRight = rightOrder ?? Number.MAX_SAFE_INTEGER;
  const leftIsNegative = normalizedLeft < 0;
  const rightIsNegative = normalizedRight < 0;

  if (leftIsNegative !== rightIsNegative) {
    return leftIsNegative ? 1 : -1;
  }

  if (!leftIsNegative && normalizedLeft !== normalizedRight) {
    return normalizedLeft - normalizedRight;
  }

  if (leftIsNegative && normalizedLeft !== normalizedRight) {
    return normalizedRight - normalizedLeft;
  }

  return 0;
}

export function getDocSummaries(): DocSummary[] {
  return fs
    .readdirSync(contentDirectory)
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      const slugName = fileName.replace(/\.md$/, '');
      const slug = slugName === 'index' ? [] : slugName.split('/');
      const { frontmatter } = readMarkdownFile(
        path.join(contentDirectory, fileName),
      );

      return {
        ...frontmatter,
        slug,
        href: slugToHref(slug),
      };
    })
    .sort((left, right) => {
      const orderComparison = compareOrder(left.order, right.order);

      if (orderComparison !== 0) {
        return orderComparison;
      }

      return left.title.localeCompare(right.title);
    });
}

export function getDocBySlug(slug: string[]): DocPage | null {
  const relativePath = slug.length === 0 ? 'index.md' : `${slug.join('/')}.md`;
  const filePath = path.join(contentDirectory, relativePath);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const { frontmatter, content } = readMarkdownFile(filePath);

  return {
    ...frontmatter,
    slug,
    href: slugToHref(slug),
    content,
  };
}
