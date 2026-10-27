import { Skeleton } from '@/components/ui/skeleton';

export function PlansSkeleton() {
  return (
    <div aria-hidden className="grid gap-6 lg:grid-cols-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="flex min-h-176 flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm md:p-8"
        >
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-8 w-48" />
          {[
            'voice',
            'ads',
            'attempts',
            'difficulty',
            'progress',
            'practice',
            'recordings',
          ].map((benefit) => (
            <Skeleton key={benefit} className="h-12 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
