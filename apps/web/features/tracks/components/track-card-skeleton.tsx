import { Skeleton } from '@/components/ui/skeleton';

import { TrackGridFrame } from './track-grid';

/** Same box as a `TrackCard`: padding, square cover and two text lines. */
function TrackCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-2">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="flex flex-col gap-0.5 px-1 pb-1">
        <Skeleton className="my-0.5 h-4 w-4/5 rounded-md" />
        <Skeleton className="my-0.5 h-3 w-1/2 rounded-md" />
      </div>
    </div>
  );
}

const skeletonKeys = (count: number) =>
  Array.from({ length: count }, (_, index) => `skeleton-${index}`);

export function TrackGridSkeleton({ count }: { count: number }) {
  return (
    <TrackGridFrame>
      {skeletonKeys(count).map((key) => (
        <li key={key}>
          <TrackCardSkeleton />
        </li>
      ))}
    </TrackGridFrame>
  );
}
