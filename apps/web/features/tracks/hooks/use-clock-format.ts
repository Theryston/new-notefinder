'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { clockMessage } from '../playback/clock-message';

/** Writes seconds as a clock (`3:08`), through the messages and next-intl. */
export function useClockFormat(): (seconds: number) => string {
  const t = useTranslations('tracks.practice');

  return useCallback(
    (seconds: number) => {
      const { key, values } = clockMessage(seconds);
      return t(key, values);
    },
    [t],
  );
}
