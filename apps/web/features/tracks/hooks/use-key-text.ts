'use client';

import type { TrackKey } from '@vozzify/contracts';
import { useTranslations } from 'next-intl';

import { useTranspose } from '../stores/transpose-store';
import { transposedKeyName } from '../transpose/key-name';

/**
 * The Track's key written out (`G major`), moved by the transposition on
 * screen; null for a Track without a key.
 */
export function useKeyText(trackKey: TrackKey | undefined): string | null {
  const t = useTranslations('tracks.practice');
  const semitones = useTranspose();
  if (trackKey === undefined) return null;
  const { tonic, mode } = transposedKeyName(trackKey, semitones);
  return t(`key.${mode}`, { tonic });
}
