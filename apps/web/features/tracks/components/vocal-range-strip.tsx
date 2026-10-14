'use client';

import type { TrackDetail } from '@notefinder/contracts';
import { pitchName } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { transposePitchClass } from '../transpose';

const PITCH_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
];
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

/** The Track's transposed vocal span and a compact octave keyboard. */
export function VocalRangeStrip({
  range,
  transpose,
}: {
  range: NonNullable<TrackDetail['vocalRange']>;
  transpose: number;
}) {
  const t = useTranslations('tracks.practice.range');
  const low = range.lowMidi + transpose;
  const high = range.highMidi + transpose;
  const lowName = pitchName(low);
  const highName = pitchName(high);
  const octaves = Math.round((high - low) / 12);

  return (
    <section
      aria-label={t('label', { low: lowName, high: highName })}
      className="flex flex-col gap-2"
    >
      <p className="font-mono text-sm tabular-nums">
        {lowName}–{highName}{' '}
        <span className="font-sans text-muted-foreground">
          · {t('octaves', { count: octaves })}
        </span>
      </p>
      <div
        aria-hidden="true"
        className="flex h-8 max-w-xs overflow-hidden rounded-md border bg-background shadow-xs"
      >
        {PITCH_NAMES.map((name, pitchClass) => {
          const selected = containsPitchClass(low, high, pitchClass);
          const black = BLACK_KEYS.has(pitchClass);
          return (
            <span
              key={name}
              className={`flex-1 border-r last:border-r-0 ${black ? 'h-5/6 bg-foreground/85' : 'h-full bg-card'} ${selected ? 'bg-primary' : ''}`}
            />
          );
        })}
      </div>
    </section>
  );
}

function containsPitchClass(low: number, high: number, pitchClass: number) {
  const first = Math.ceil(low);
  const last = Math.floor(high);
  for (let midi = first; midi <= last; midi += 1) {
    if (transposePitchClass(midi % 12, 0) === pitchClass) return true;
  }
  return false;
}
