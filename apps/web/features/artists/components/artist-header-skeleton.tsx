import { cn } from 'cn';
import { getTranslations } from 'next-intl/server';

import {
  entityBannerClass,
  entityBannerRowClass,
  entitySkeletonClass,
} from '@/components/entity-header';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Same-dimension stand-in for the artist banner, so loading never moves
 * the layout: orange surface, circle visual, oversized title, count and
 * genre chips.
 */
export async function ArtistHeaderSkeleton() {
  const t = await getTranslations('artists');

  return (
    <div
      role="status"
      aria-label={t('header.loading')}
      className={entityBannerClass}
    >
      <div className={entityBannerRowClass}>
        <Skeleton
          className={cn(
            'size-24 shrink-0 rounded-full sm:size-32 md:size-40',
            entitySkeletonClass,
          )}
        />
        <div className="flex min-w-0 flex-col gap-3 sm:flex-1">
          <Skeleton
            className={cn(
              'h-12 w-48 rounded-md md:h-16 md:w-64',
              entitySkeletonClass,
            )}
          />
          <Skeleton
            className={cn('h-5 w-24 rounded-md', entitySkeletonClass)}
          />
          <div className="flex flex-wrap gap-2">
            <Skeleton
              className={cn('h-6 w-16 rounded-full', entitySkeletonClass)}
            />
            <Skeleton
              className={cn('h-6 w-20 rounded-full', entitySkeletonClass)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
