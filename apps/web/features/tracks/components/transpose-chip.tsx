'use client';

import type { TrackKey } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { createContext, use } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useKeyText } from '../hooks/use-key-text';
import { useTranspose } from '../stores/transpose-store';

/**
 * The Track's key, for the dock's transpose chip. The popover behind the chip
 * loads after the page and its placeholder takes no props, so both read the
 * key from here.
 */
export const TrackKeyContext = createContext<TrackKey | undefined>(undefined);

export const TRANSPOSE_CHIP_CLASS = cn(
  buttonVariants({ variant: 'secondary' }),
  'w-32 gap-1.5 px-3 font-medium sm:w-40',
);

/** The key the Track is in now and, once moved, the offset (`A major +2`). */
export function TransposeChipLabel() {
  const t = useTranslations('tracks.practice.dock');
  const semitones = useTranspose();
  const keyText = useKeyText(use(TrackKeyContext));

  return (
    <>
      {keyText === null ? null : (
        <span className="hidden text-muted-foreground sm:inline">
          {t('transposeLabel')}
        </span>
      )}
      <span>{keyText ?? t('transpose')}</span>
      {semitones === 0 ? null : (
        <span className="font-mono text-muted-foreground text-xs tabular-nums">
          {t('transposeValue', { semitones })}
        </span>
      )}
    </>
  );
}

/**
 * The chip as the page first paints it, while the popover loads: same size
 * and look, so nothing moves when the real one takes its place.
 */
export function TransposeChipPlaceholder() {
  return (
    <button type="button" aria-disabled="true" className={TRANSPOSE_CHIP_CLASS}>
      <TransposeChipLabel />
    </button>
  );
}
