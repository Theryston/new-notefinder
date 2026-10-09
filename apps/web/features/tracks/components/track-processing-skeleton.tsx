import { TRACK_PROCESSING_STEPS } from '@notefinder/contracts';
import { getTranslations } from 'next-intl/server';

import {
  entityBannerRowClass,
  entityBannerSurfaceClass,
  entitySkeletonClass,
} from '@/components/entity-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Same-dimension stand-in for the Processing page while the state streams in:
 * the banner (stage, title, artist credit, step pills, the ring) and the
 * status lines under it, so loading never moves the layout.
 */
export async function TrackProcessingSkeleton() {
  const t = await getTranslations('tracks.processing');

  return (
    <div
      role="status"
      aria-label={t('progress.label')}
      className="flex flex-col gap-10 pb-6 md:gap-12 md:pb-8"
    >
      <div className={entityBannerSurfaceClass}>
        <div className={entityBannerRowClass}>
          <Skeleton
            className={cn(
              'size-40 shrink-0 rounded-full md:size-72',
              entitySkeletonClass,
            )}
          />
          <div className="flex min-w-0 flex-col gap-3 sm:flex-1">
            <Skeleton
              className={cn('h-5 w-56 rounded-md', entitySkeletonClass)}
            />
            <Skeleton
              className={cn(
                'h-12 w-48 rounded-md md:h-16 md:w-64',
                entitySkeletonClass,
              )}
            />
            <Skeleton
              className={cn('h-5 w-32 rounded-md', entitySkeletonClass)}
            />
            <div className="flex flex-wrap gap-2 pt-2">
              {TRACK_PROCESSING_STEPS.map((step) => (
                <Skeleton
                  key={step}
                  className={cn('h-8 w-20 rounded-full', entitySkeletonClass)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-5 w-full max-w-prose rounded-md" />
        <Skeleton className="h-5 w-40 rounded-md" />
      </div>
    </div>
  );
}
