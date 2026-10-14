'use client';

import type { TrackLyricLine } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { memo } from 'react';

import { cn } from '@/lib/utils';

import { useActiveLineIndex } from '../hooks/use-active-line-index';
import type { LyricsClock } from '../hooks/use-lyrics-signature';

const LyricLineButton = memo(function LyricLineButton({
  line,
  active,
  onSeek,
}: {
  line: TrackLyricLine;
  active: boolean;
  onSeek: ((seconds: number) => void) | undefined;
}) {
  return (
    <li className="break-inside-avoid">
      <button
        type="button"
        disabled={onSeek === undefined}
        aria-current={active ? 'true' : undefined}
        onClick={() => onSeek?.(line.start)}
        className={cn(
          'w-full rounded-lg px-2 py-1 text-left text-sm leading-6 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-pointer enabled:hover:bg-accent',
          // Orange text is for short labels (DESIGN.md), so the line is tinted.
          active
            ? 'bg-primary/10 font-medium text-foreground'
            : 'text-muted-foreground',
        )}
      >
        {line.words.map((word) => word.text).join(' ')}
      </button>
    </li>
  );
});

/**
 * The whole Timed lyrics, compact: the lines flow into columns on wide screens
 * (the verses side by side). A line is a button that seeks to where it starts,
 * and the one being sung is highlighted. Without `onSeek` (the player is not
 * ready) the lines are shown but cannot be clicked. Only the line that gains
 * or loses the highlight re-renders as the music plays.
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
  const active = useActiveLineIndex(lines, clock);

  return (
    <section aria-labelledby="lyrics-heading" className="flex flex-col gap-3">
      <h2 id="lyrics-heading" className="font-semibold text-lg">
        {t('title')}
      </h2>
      <ul className="gap-x-8 md:columns-2 xl:columns-3">
        {lines.map((line, index) => (
          <LyricLineButton
            key={`${line.start}-${line.end}`}
            line={line}
            active={index === active}
            onSeek={onSeek}
          />
        ))}
      </ul>
    </section>
  );
}
