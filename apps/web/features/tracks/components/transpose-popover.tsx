'use client';

import { RotateCcwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { use } from 'react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';

import { useKeyText } from '../hooks/use-key-text';
import { setTranspose, useTranspose } from '../stores/transpose-store';
import {
  TRANSPOSE_CHIP_CLASS,
  TrackKeyContext,
  TransposeChipLabel,
} from './transpose-chip';
import { TransposeStepper } from './transpose-stepper';

/**
 * The dock's transpose chip and the popover it opens: the stepper, a button
 * back to the original key and why the video does not follow. The reset sits
 * in the title row, which keeps its height without it, so stepping never
 * moves the buttons under the User's finger. The dock loads it after the page,
 * like the Settings menu, to keep Base UI's popover out of first-load JS.
 */
export function TransposePopover() {
  const t = useTranslations('tracks.practice.dock');
  const trackKey = use(TrackKeyContext);
  const keyText = useKeyText(trackKey);
  const semitones = useTranspose();

  return (
    <Popover>
      <PopoverTrigger
        aria-label={
          keyText === null
            ? t('transpose')
            : t('transposeOpen', { key: keyText })
        }
        className={TRANSPOSE_CHIP_CLASS}
      >
        <TransposeChipLabel />
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={12}>
        <div className="flex min-h-10 items-center justify-between gap-2">
          <PopoverTitle className="font-semibold">
            {t('transpose')}
          </PopoverTitle>
          {semitones === 0 ? null : (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('transposeReset')}
              onClick={() => setTranspose(0)}
            >
              <RotateCcwIcon aria-hidden="true" />
            </Button>
          )}
        </div>
        <TransposeStepper trackKey={trackKey} />
        <PopoverDescription>{t('videoKeepsKey')}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
