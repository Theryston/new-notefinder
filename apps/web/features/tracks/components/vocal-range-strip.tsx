'use client';

import type { TrackVocalRange } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { useTranspose } from '../stores/transpose-store';
import {
  BLACK_KEY_HEIGHT,
  BLACK_KEY_WIDTH,
  keyboardLayout,
  WHITE_KEY_HEIGHT,
  WHITE_KEY_WIDTH,
} from '../transpose/keyboard-layout';
import { transposeRange } from '../transpose/transpose';
import { describeRange } from '../transpose/vocal-range';

/**
 * A small keyboard with the vocal range lit in orange. The white keys are
 * drawn first and the black ones over them, as on a piano.
 */
function RangeKeyboard({
  range,
  label,
}: {
  range: TrackVocalRange;
  label: string;
}) {
  const { keys, width } = keyboardLayout(range);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${WHITE_KEY_HEIGHT}`}
      // The drawing fills its box, so it lines up with the timeline's edge;
      // the keys stretch with it and their outlines keep one pixel.
      preserveAspectRatio="none"
      className="h-10 w-full shrink-0 overflow-hidden rounded-md border sm:w-64"
    >
      {keys.map((key) => (
        <rect
          key={key.midi}
          x={key.x}
          width={key.black ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH}
          height={key.black ? BLACK_KEY_HEIGHT : WHITE_KEY_HEIGHT}
          className={cn(
            '[vector-effect:non-scaling-stroke]',
            // Lit keys are separated by the page color, so the range still
            // reads as keys and not one bar.
            key.inRange
              ? 'fill-primary stroke-background'
              : key.black
                ? 'fill-timeline-key-sharp stroke-border'
                : 'fill-timeline-key stroke-border',
          )}
        />
      ))}
    </svg>
  );
}

/**
 * The vocal range on one line under the timeline (`D4–D5 · 1 octave`) with the
 * range lit on a small keyboard. Both follow the transposition. It renders
 * nothing for a Track without a range.
 */
export function VocalRangeStrip({
  range,
}: {
  range: TrackVocalRange | undefined;
}) {
  const t = useTranslations('tracks.practice.range');
  const semitones = useTranspose();
  if (range === undefined) return null;
  const shifted = transposeRange(range, semitones);
  const { low, high, octaves } = describeRange(shifted);

  return (
    <section
      aria-label={t('label')}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <p
        data-testid="vocal-range"
        className="font-mono text-muted-foreground text-sm tabular-nums"
      >
        {t('summary', { low, high, octaves })}
      </p>
      <RangeKeyboard range={shifted} label={t('keyboard', { low, high })} />
    </section>
  );
}
