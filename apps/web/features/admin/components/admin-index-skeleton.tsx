import { Skeleton } from '@/components/ui/skeleton';

/** Stand-in for the admin cards while the session loads. */
export function AdminIndexSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 py-2"
      aria-label="Loading"
      role="status"
    >
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  );
}
