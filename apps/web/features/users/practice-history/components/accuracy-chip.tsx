'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import {
  type AccuracyStatus,
  accuracyPercent,
  accuracyStatus,
} from '../accuracy-status';

/** The dot repeats the word, so the status never relies on color alone. */
const DOT_CLASS: Record<AccuracyStatus, string> = {
  hit: 'bg-pitch-hit',
  near: 'bg-pitch-near',
  miss: 'bg-pitch-miss',
};

/** A run's accuracy as a chip: a status dot, the number, then the word. */
export function AccuracyChip({ accuracy }: { accuracy: number }) {
  const t = useTranslations('profileHistory');
  const status = accuracyStatus(accuracy);
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-2.5 py-1 font-semibold text-xs tabular-nums">
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', DOT_CLASS[status])}
      />
      <span>{t('percent', { percent: accuracyPercent(accuracy) })}</span>
      <span>{t(`accuracy.${status}`)}</span>
    </span>
  );
}
