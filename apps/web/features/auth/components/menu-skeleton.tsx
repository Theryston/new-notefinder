import { Skeleton } from '@/components/ui/skeleton';

/** Stands in for a header menu button (same size) while it loads. */
export function MenuSkeleton() {
  return <Skeleton className="size-10 rounded-full" />;
}
