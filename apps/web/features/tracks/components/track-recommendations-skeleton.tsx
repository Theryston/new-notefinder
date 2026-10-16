import { Skeleton } from '@/components/ui/skeleton';
import { TrackCardGrid } from './track-card-grid';
import { TrackCardMoreSkeletons } from './track-card-skeleton';

/** Reserve the heading and seven card slots while suggestions stream separately. */
export function TrackRecommendationsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-4 pb-[calc(var(--dock-height,0px)+1.5rem)]"
    >
      <Skeleton className="h-8 w-48 rounded-md" />
      <TrackCardGrid>
        <TrackCardMoreSkeletons />
      </TrackCardGrid>
    </div>
  );
}
