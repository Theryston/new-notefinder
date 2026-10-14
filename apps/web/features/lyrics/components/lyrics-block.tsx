'use client';

import type { TrackLyricLine } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { lineIndexAt } from '../lyrics-position';
import { type LyricsClock, useLyricsSignature } from './use-lyrics-signature';

/**
 * The whole Timed lyrics, compact: the lines flow into columns on wide screens
 * (the verses side by side). A line is a button that seeks to where it starts,
 * and the one being sung is highlighted. Without `onSeek` (the player is not
 * ready) the lines are shown but cannot be clicked.
 */
export function LyricsBlock({
  lines,
  clock,
  onSeek,
}: {
  lines: readonly TrackLyricLine[];
  clock: LyricsClock;
  onSeek?: (seconds: number) => void;
}) {
  const t = useTranslations('tracks.practice.lyrics');
  useLyricsSignature(lines, clock);
  const active = lineIndexAt(lines, clock.now());

  return (
    <section aria-labelledby="lyrics-heading" className="flex flex-col gap-3">
      <h2 id="lyrics-heading" className="font-semibold text-lg">
        {t('title')}
      </h2>
      <ul className="gap-x-8 md:columns-2 xl:columns-3">
        {lines.map((line, index) => (
          <li key={`${line.start}-${line.end}`} className="break-inside-avoid">
            <button
              type="button"
              disabled={onSeek === undefined}
              aria-current={index === active ? 'true' : undefined}
              onClick={() => onSeek?.(line.start)}
              className={cn(
                'w-full rounded-lg px-2 py-1 text-left text-sm leading-6 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-pointer enabled:hover:bg-accent',
                index === active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground',
              )}
            >
              {line.words.map((word) => word.text).join(' ')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
