'use client';

import type { TrackLyricLine } from '@notefinder/contracts';

import { cn } from '@/lib/utils';
import {
  type LyricsClock,
  useLyricsSignature,
} from '../hooks/use-lyrics-signature';
import { lineIndexAt, type WordState, wordStateAt } from '../lyrics-position';

const WORD_CLASS: Record<WordState, string> = {
  sung: 'text-foreground',
  current: 'text-primary',
  upcoming: 'text-muted-foreground',
};

/**
 * The line being sung, under the timeline, with the word being sung
 * highlighted. Before the first line starts it shows that line as what comes
 * next; after the last it keeps the last one. The caller mounts it
 * only once the lyrics are loaded, holding a slot of its height (`min-h-8`)
 * while they load, so the page does not shift when they arrive.
 */
export function KaraokeLine({
  lines,
  clock,
}: {
  lines: readonly TrackLyricLine[];
  clock: LyricsClock;
}) {
  useLyricsSignature(lines, clock);
  const time = clock.now();
  const line = lines[Math.max(0, lineIndexAt(lines, time))];

  return (
    <p
      data-testid="karaoke-line"
      className="min-h-8 text-center font-semibold text-lg leading-8 md:text-xl"
    >
      {line?.words.map((word, index) => {
        const state = wordStateAt(word, time);
        return (
          <span
            // A line's words are fixed, so the position is their identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: the same word can repeat in a line.
            key={index}
            data-state={state}
            className={cn('transition-colors duration-150', WORD_CLASS[state])}
          >
            {index > 0 ? ' ' : null}
            {word.text}
          </span>
        );
      })}
    </p>
  );
}
