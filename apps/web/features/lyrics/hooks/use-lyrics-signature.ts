'use client';

import type { TrackLyricLine } from '@notefinder/contracts';
import { useSyncExternalStore } from 'react';

import { lyricsSignatureAt } from '../lyrics-position';

/**
 * Where the lyrics get the moment of the Track, and when it changes. It is read
 * and subscribed to outside React, like the timeline's clock.
 */
export type LyricsClock = {
  now(): number;
  subscribe(listener: () => void): () => void;
};

/**
 * Re-renders the caller only when what the lyrics show changes (the karaoke
 * slot's displayed line, a word starting or ending), not on every tick of
 * the clock. The server and the first client render both start the Track at 0.
 */
export function useLyricsSignature(
  lines: readonly TrackLyricLine[],
  clock: LyricsClock,
): number {
  return useSyncExternalStore(
    clock.subscribe,
    () => lyricsSignatureAt(lines, clock.now()),
    () => lyricsSignatureAt(lines, 0),
  );
}
