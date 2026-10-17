'use client';

import { useEffect, useLayoutEffect } from 'react';

// `useLayoutEffect` warns on the server, where it never runs: alias it there.
const usePrePaintEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Applies the stored/OS theme before paint on the standalone 404 (it renders
 * no ThemeProvider): same sources as next-themes' defaults (stored choice,
 * then OS), so dark-mode visitors don't get a light page.
 */
export function NotFoundTheme() {
  usePrePaintEffect(() => {
    try {
      const stored = localStorage.getItem('theme') ?? 'system';
      const theme =
        stored === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : stored;
      if (theme === 'dark') document.documentElement.classList.add('dark');
    } catch {
      // Storage unavailable (e.g. private mode): stay light.
    }
  }, []);

  return null;
}
