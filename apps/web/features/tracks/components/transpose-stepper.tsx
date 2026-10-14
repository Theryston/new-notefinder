'use client';

import type { TrackKey } from '@notefinder/contracts';
import { MinusIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { useKeyText } from '../hooks/use-key-text';
import { setTranspose, useTranspose } from '../stores/transpose-store';
import {
  clampTranspose,
  MAX_TRANSPOSE,
  MIN_TRANSPOSE,
} from '../transpose/transpose';

/** One toast at a time: stepping again replaces it instead of stacking. */
const KEEPS_KEY_TOAST_ID = 'transpose-video-keeps-key';

/**
 * The dock's transpose stepper: a semitone down or up, with the resulting key
 * and the offset between them (`A major`, `+2`) and a button back to the
 * original key. The video is YouTube's and keeps its original key, so each
 * change tells the User only the notes (and the key and range shown) moved.
 */
export function TransposeStepper({
  trackKey,
}: {
  trackKey: TrackKey | undefined;
}) {
  const t = useTranslations('tracks.practice.dock');
  const semitones = useTranspose();
  const keyText = useKeyText(trackKey);

  const change = (next: number) => {
    setTranspose(clampTranspose(next));
    toast(t('videoKeepsKey'), { id: KEEPS_KEY_TOAST_ID });
  };

  return (
    <fieldset
      aria-label={t('transpose')}
      className="m-0 flex min-w-0 items-center border-0 p-0"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('transposeDown')}
        disabled={semitones <= MIN_TRANSPOSE}
        onClick={() => change(semitones - 1)}
      >
        <MinusIcon aria-hidden="true" />
      </Button>
      <div className="flex min-w-14 flex-col items-center leading-tight">
        {keyText === null ? null : (
          <span
            data-testid="transpose-key"
            className="whitespace-nowrap font-medium text-sm"
          >
            {keyText}
          </span>
        )}
        <output
          data-testid="transpose-value"
          className="font-mono text-muted-foreground text-xs tabular-nums"
        >
          {t('transposeValue', { semitones })}
        </output>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('transposeUp')}
        disabled={semitones >= MAX_TRANSPOSE}
        onClick={() => change(semitones + 1)}
      >
        <PlusIcon aria-hidden="true" />
      </Button>
      {semitones === 0 ? null : (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('transposeReset')}
          onClick={() => change(0)}
        >
          <RotateCcwIcon aria-hidden="true" />
        </Button>
      )}
    </fieldset>
  );
}
