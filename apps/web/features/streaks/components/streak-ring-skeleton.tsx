import { Skeleton } from '@/components/ui/skeleton';

/** Same-size stand-in for the ring while the session or the status loads. */
export function StreakRingSkeleton() {
  return <Skeleton className="size-10 shrink-0 rounded-full" />;
}
