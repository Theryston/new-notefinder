import { Skeleton } from '@/components/ui/skeleton';

/**
 * One card-shaped placeholder: square cover plus title and artist lines,
 * with the same outer dimensions as a TrackCard so skeletons never shift
 * the layout when the final cards land.
 */
export function TrackCardSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl p-2">
      <Skeleton className="aspect-square h-auto w-full rounded-xl" />
      <div className="flex flex-col gap-0.5 px-1">
        <Skeleton className="h-5 w-4/5 rounded-md" />
        <Skeleton className="h-4 w-3/5 rounded-md" />
      </div>
    </div>
  );
}

const MORE_SKELETON_KEYS = [
  'more-0',
  'more-1',
  'more-2',
  'more-3',
  'more-4',
  'more-5',
  'more-6',
];

/**
 * Card blocks appended while the next page loads. Shared by every
 * paginated cover grid (Search, Artist) so the paging append looks
 * identical everywhere.
 */
export function TrackCardMoreSkeletons() {
  return (
    <>
      {MORE_SKELETON_KEYS.map((key) => (
        <TrackCardSkeleton key={key} />
      ))}
    </>
  );
}
