'use client';

import { PITCH_CLASS_NAMES, type TrackKey } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { useTranspose } from '../stores/transpose-store';
import { transposeKey } from '../transpose/transpose';

/**
 * The Track's key written out (`G major`), moved by the transposition on
 * screen; null for a Track without a key.
 */
export function useKeyText(trackKey: TrackKey | undefined): string | null {
  const t = useTranslations('tracks.practice');
  const semitones = useTranspose();
  if (trackKey === undefined) return null;
  const { tonic, mode } = transposeKey(trackKey, semitones);
  return t(`key.${mode}`, { tonic: PITCH_CLASS_NAMES[tonic] ?? '' });
}
