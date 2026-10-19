import { Skeleton } from '@/components/ui/skeleton';

/** Keys only need to be distinct; the rows never reorder. */
const SKELETON_ROWS = ['first', 'second', 'third', 'fourth', 'fifth'];

/**
 * Stand-in rows with the height of real runs: the cover and the three text
 * lines (title, artist, setup) at their line heights, so the list keeps its
 * size while it waits for the viewer's time zone.
 */
export function PracticeHistoryRowSkeletons() {
  return (
    <ul aria-hidden="true" className="flex flex-col gap-1">
      {SKELETON_ROWS.map((row) => (
        <li key={row} className="flex items-center gap-3 rounded-2xl p-2">
          <Skeleton className="size-14 shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Skeleton className="h-6 w-2/3 rounded-md" />
            <Skeleton className="h-5 w-1/2 rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded-md" />
          </div>
          <Skeleton className="h-7 w-24 shrink-0 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
