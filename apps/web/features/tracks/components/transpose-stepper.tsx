'use client';

import type { TrackKey } from '@vozzify/contracts';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { useKeyText } from '../hooks/use-key-text';
import { setTranspose, useTranspose } from '../stores/transpose-store';
import { MAX_TRANSPOSE, MIN_TRANSPOSE } from '../transpose/transpose';

/**
 * The transpose stepper: a semitone down or up, with the resulting key and
 * the offset between them (`A major`, `+2`).
 */
export function TransposeStepper({
  trackKey,
}: {
  trackKey: TrackKey | undefined;
}) {
  const t = useTranslations('tracks.practice.dock');
  const semitones = useTranspose();
  const keyText = useKeyText(trackKey);

  return (
    <fieldset
      aria-label={t('transpose')}
      className="m-0 flex items-center justify-between border-0 p-0"
    >
      <Button
        variant="outline"
        size="icon"
        aria-label={t('transposeDown')}
        disabled={semitones <= MIN_TRANSPOSE}
        onClick={() => setTranspose(semitones - 1)}
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
        variant="outline"
        size="icon"
        aria-label={t('transposeUp')}
        disabled={semitones >= MAX_TRANSPOSE}
        onClick={() => setTranspose(semitones + 1)}
      >
        <PlusIcon aria-hidden="true" />
      </Button>
    </fieldset>
  );
}
