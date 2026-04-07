import type { Metadata } from 'next';
import Script from 'next/script';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://niapya.github.io/clawless'),
  title: 'ClawLess Docs',
  description:
    'Markdown-driven product documentation published with GitHub Pages.',
  alternates: {
    canonical: 'https://niapya.github.io/clawless',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              var storageKey = 'claw-less-docs-theme';
              var stored = localStorage.getItem(storageKey);
              var theme = stored === 'light' || stored === 'dark'
                ? stored
                : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
              document.documentElement.dataset.theme = theme;
            })();
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
