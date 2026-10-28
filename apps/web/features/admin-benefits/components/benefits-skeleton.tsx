'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

export function BenefitsSkeleton() {
  const t = useTranslations('adminBenefits');
  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="flex flex-col gap-8 py-6"
    >
      <div className="flex justify-end">
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-2xl border bg-card p-5"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-7 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((index) => (
          <Skeleton key={index} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
