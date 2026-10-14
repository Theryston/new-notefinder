'use client';

import type { TrackLyricLine } from '@notefinder/contracts';
import { useSyncExternalStore } from 'react';

import { lineIndexAt } from '../lyrics-position';
import type { LyricsClock } from './use-lyrics-signature';

/**
 * The index of the line being sung, re-rendering the caller only when it
 * changes, not on every tick of the clock. The server and the first client
 * render both start the Track at 0.
 */
export function useActiveLineIndex(
  lines: readonly TrackLyricLine[],
  clock: LyricsClock,
): number {
  return useSyncExternalStore(
    clock.subscribe,
    () => lineIndexAt(lines, clock.now()),
    () => lineIndexAt(lines, 0),
  );
}
