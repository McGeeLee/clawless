'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

type MarkdownContentProps = {
  content: string;
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void content;

    const contentElement = contentRef.current;

    if (!contentElement) {
      return;
    }

    const scripts = Array.from(contentElement.querySelectorAll('script'));

    for (const script of scripts) {
      const executableScript = document.createElement('script');

      for (const attribute of Array.from(script.attributes)) {
        executableScript.setAttribute(attribute.name, attribute.value);
      }

      executableScript.text = script.textContent ?? '';
      script.replaceWith(executableScript);
    }
  }, [content]);

  return (
    <div ref={contentRef} className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
