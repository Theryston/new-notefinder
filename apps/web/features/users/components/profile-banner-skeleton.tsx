import { getTranslations } from 'next-intl/server';
import {
  entityBannerClass,
  entityBannerRowClass,
  entitySkeletonClass,
} from '@/components/entity-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Same-dimension stand-in for the Profile banner while it loads: orange
 * surface, circle Avatar, the Name, and the two info lines.
 */
export async function ProfileBannerSkeleton() {
  const t = await getTranslations('publicProfile');

  return (
    <div
      role="status"
      aria-label={t('banner.loading')}
      className={entityBannerClass}
    >
      <div className={entityBannerRowClass}>
        <Skeleton
          className={cn(
            'size-24 shrink-0 rounded-full sm:size-32 md:size-48',
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
          <Skeleton
            className={cn('h-5 w-44 rounded-md', entitySkeletonClass)}
          />
        </div>
      </div>
    </div>
  );
}
