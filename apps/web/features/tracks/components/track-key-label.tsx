'use client';

import { PITCH_CLASS_NAMES, type TrackKey } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { useTranspose } from '../stores/transpose-store';
import { transposeKey } from '../transpose/transpose';

/**
 * The Track's estimated key (`G major`) for the title row, moved by the
 * transposition. It renders nothing, separator included, for a Track without a
 * key.
 */
export function TrackKeyLabel({
  trackKey,
}: {
  trackKey: TrackKey | undefined;
}) {
  const t = useTranslations('tracks.practice');
  const semitones = useTranspose();
  if (trackKey === undefined) return null;
  const { tonic, mode } = transposeKey(trackKey, semitones);
  const text = t(`key.${mode}`, { tonic: PITCH_CLASS_NAMES[tonic] ?? '' });

  return (
    <>
      <span aria-hidden="true">·</span>
      <span className="sr-only">{t('key.label', { key: text })}</span>
      <span aria-hidden="true" className="shrink-0" data-testid="track-key">
        {text}
      </span>
    </>
  );
}
