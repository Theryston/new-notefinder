import { getTranslations } from 'next-intl/server';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Same-dimension stand-in for the artist header, so loading never moves
 * the layout: circle visual, title, count and genre chips.
 */
export async function ArtistHeaderSkeleton() {
  const t = await getTranslations('artists');

  return (
    <div
      role="status"
      aria-label={t('header.loading')}
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6"
    >
      <Skeleton className="size-24 shrink-0 rounded-full sm:size-32 md:size-40" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48 rounded-md md:h-10 md:w-64" />
        <Skeleton className="h-5 w-24 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
