import { Skeleton } from '@/components/ui/skeleton';

/** Stand-in for the panel while the session or the pins load. */
export function AdminHomePinsSkeleton() {
  return (
    <div
      className="flex flex-col gap-4 py-10"
      aria-label="Loading"
      role="status"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 max-w-prose" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    </div>
  );
}
