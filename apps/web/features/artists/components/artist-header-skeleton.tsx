import { getTranslations } from 'next-intl/server';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Same-dimension stand-in for the artist banner, so loading never moves
 * the layout: gradient surface, circle visual, oversized title, count and
 * genre chips.
 */
export async function ArtistHeaderSkeleton() {
  const t = await getTranslations('artists');

  return (
    <div
      role="status"
      aria-label={t('header.loading')}
      className="overflow-hidden rounded-2xl bg-gradient-to-b from-muted via-muted/50 to-background px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Skeleton className="size-24 shrink-0 rounded-full sm:size-32 md:size-40" />
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-12 w-48 rounded-md md:h-16 md:w-64" />
          <Skeleton className="h-5 w-24 rounded-md" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
