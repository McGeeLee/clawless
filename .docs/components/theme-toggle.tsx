'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'claw-less-docs-theme';

type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === 'undefined') {
      return 'light';
    }

    const activeTheme = document.documentElement.dataset.theme;

    return activeTheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(
      STORAGE_KEY,
    ) as Theme | null;
    const nextTheme =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : getSystemTheme();

    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';

    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <span className="theme-toggle-label">
        {theme === 'light' ? 'Light' : 'Dark'} mode
      </span>
    </button>
  );
}
