'use client';

import { MinusIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { setTranspose, useTranspose } from '../stores/transpose-store';
import {
  clampTranspose,
  MAX_TRANSPOSE,
  MIN_TRANSPOSE,
} from '../transpose/transpose';

/** One toast at a time: stepping again replaces it instead of stacking. */
const KEEPS_KEY_TOAST_ID = 'transpose-video-keeps-key';

/**
 * The dock's transpose stepper: a semitone down or up. The video is YouTube's
 * and keeps its original key, so each step tells the User only the notes (and
 * the key and range shown) moved.
 */
export function TransposeStepper() {
  const t = useTranslations('tracks.practice.dock');
  const semitones = useTranspose();

  const step = (delta: number) => {
    setTranspose(clampTranspose(semitones + delta));
    toast(t('videoKeepsKey'), { id: KEEPS_KEY_TOAST_ID });
  };

  return (
    <fieldset
      aria-label={t('transpose')}
      className="m-0 flex min-w-0 items-center gap-0.5 border-0 p-0"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('transposeDown')}
        disabled={semitones <= MIN_TRANSPOSE}
        onClick={() => step(-1)}
      >
        <MinusIcon aria-hidden="true" />
      </Button>
      <output
        data-testid="transpose-value"
        className="min-w-8 text-center font-mono text-sm tabular-nums"
      >
        {t('transposeValue', { semitones })}
      </output>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('transposeUp')}
        disabled={semitones >= MAX_TRANSPOSE}
        onClick={() => step(1)}
      >
        <PlusIcon aria-hidden="true" />
      </Button>
    </fieldset>
  );
}
