import { getTranslations } from 'next-intl/server';

import {
  entityBannerClass,
  entityBannerRowClass,
  entitySkeletonClass,
} from '@/components/entity-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Same-dimension stand-in for the Processing page while the state streams in:
 * the banner (cover, title, artist credit) and the progress bar, so loading
 * never moves the layout.
 */
export async function TrackProcessingSkeleton() {
  const t = await getTranslations('tracks.processing');

  return (
    <div
      role="status"
      aria-label={t('progress.label')}
      className="flex flex-col gap-8 pb-6 md:pb-8"
    >
      <div className={entityBannerClass}>
        <div className={entityBannerRowClass}>
          <Skeleton
            className={cn(
              'size-24 shrink-0 rounded-xl sm:size-32 md:size-48',
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
              className={cn('h-5 w-32 rounded-md', entitySkeletonClass)}
            />
          </div>
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}
