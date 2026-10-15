import { Skeleton } from '@/components/ui/skeleton';

/** Same-size stand-in for the ring while the session or the status loads. */
export function StreakRingSkeleton() {
  const t = useTranslations('streaks');

  return (
    <div
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center gap-2 rounded-full border border-transparent md:w-auto md:pr-3"
    >
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <span className="hidden font-semibold text-sm text-transparent md:inline">
        {t('practiceLabel')}
      </span>
    </div>
  );
}

import { useTranslations } from 'next-intl';
