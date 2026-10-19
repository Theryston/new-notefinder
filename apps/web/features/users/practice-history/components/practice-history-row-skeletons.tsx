import { Skeleton } from '@/components/ui/skeleton';

/** What a stand-in needs from the run it stands for: its key, and whether the run shows the bleed marker. */
export type StandInRow = { id: string; bleedSuspected: boolean };

/**
 * Stand-in rows at the height of the runs they stand for: the cover, the title,
 * artist and setup lines at their line heights, and one more line where the run
 * shows the bleed marker. The rows come from the server's first page, so the
 * list keeps its height while it waits for the viewer's time zone.
 *
 * Residual shift this does not remove: the day headings and the gaps between
 * day groups. Their number depends on the viewer's time zone, which only the
 * browser knows, so they cannot be reserved. The profile page keeps the CLS
 * below 0.1 with them (measured in the Playwright suite).
 */
export function PracticeHistoryRowSkeletons({
  rows,
}: {
  rows: readonly StandInRow[];
}) {
  return (
    <ul aria-hidden="true" className="flex flex-col gap-1">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl p-2"
        >
          <Skeleton className="size-14 shrink-0 rounded-md" />
          <div className="flex min-w-48 flex-1 flex-col gap-0.5">
            <Skeleton className="h-6 w-2/3 rounded-md" />
            <Skeleton className="h-5 w-1/2 rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded-md" />
            {row.bleedSuspected ? (
              <Skeleton className="h-4 w-24 rounded-md" />
            ) : null}
          </div>
          <Skeleton className="h-7 w-24 shrink-0 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
