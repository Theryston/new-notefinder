'use client';

import { useEffect, useState } from 'react';

/** How often the elapsed time is counted, in milliseconds. */
const TICK_MS = 1_000;

/**
 * Milliseconds since `key` last changed, counted in ticks while the component
 * is mounted. It starts at 0 on the server and on the first render, so the
 * markup matches, and it restarts whenever the key changes.
 */
export function useElapsedSince(key: string): number {
  const [clock, setClock] = useState({ key, elapsedMs: 0 });
  if (clock.key !== key) {
    // Restarting during render, not in an effect, means the render that shows
    // the new key already counts from zero.
    setClock({ key, elapsedMs: 0 });
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setClock((previous) =>
        previous.key === key
          ? { key, elapsedMs: previous.elapsedMs + TICK_MS }
          : previous,
      );
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [key]);

  return clock.key === key ? clock.elapsedMs : 0;
}
