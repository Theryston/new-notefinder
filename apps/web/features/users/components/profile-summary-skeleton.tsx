import { getTranslations } from 'next-intl/server';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Same-dimension stand-in for the Summary section while its numbers load: the
 * title and the four numbers with their labels, in the same grid.
 */
export async function ProfileSummarySkeleton() {
  const t = await getTranslations('publicProfile.summary');

  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-8 w-32 rounded-md" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        {['streak', 'sung', 'favorites', 'contributions'].map((key) => (
          <div key={key} className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md md:h-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
