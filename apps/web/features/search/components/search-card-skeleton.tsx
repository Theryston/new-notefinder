import { Skeleton } from '@/components/ui/skeleton';

/** One card-shaped placeholder: square cover plus title and artist lines. */
export function SearchCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-2xl p-3">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="flex flex-col gap-0.5 px-1">
        <Skeleton className="h-5 w-4/5 rounded-md" />
        <Skeleton className="h-4 w-3/5 rounded-md" />
      </div>
    </div>
  );
}
