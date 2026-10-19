'use client';

import { type AccuracyBand, accuracyBand } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

/** The dot repeats the word, so the band never relies on color alone. */
const DOT_CLASS: Record<AccuracyBand, string> = {
  hit: 'bg-pitch-hit',
  near: 'bg-pitch-near',
  miss: 'bg-pitch-miss',
};

/** A run's accuracy as a chip: a band dot, the number, then the band's word. */
export function AccuracyChip({ accuracy }: { accuracy: number }) {
  const t = useTranslations('profileHistory');
  const band = accuracyBand(accuracy);
  return (
    <span
      data-testid="accuracy-chip"
      data-band={band}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-2.5 py-1 font-semibold text-xs tabular-nums"
    >
      <span
        aria-hidden="true"
        data-testid="accuracy-dot"
        className={cn('size-2 rounded-full', DOT_CLASS[band])}
      />
      <span>{t('percent', { percent: Math.round(accuracy * 100) })}</span>
      <span>{t(`accuracy.${band}`)}</span>
    </span>
  );
}
