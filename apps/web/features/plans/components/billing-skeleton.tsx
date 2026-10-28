import { Skeleton } from '@/components/ui/skeleton';

export function BillingSkeleton({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:gap-12"
    >
      <div className="flex min-h-104 flex-col justify-between gap-8 rounded-2xl bg-surface p-6 shadow-sm md:p-8">
        <div className="space-y-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-15 w-40" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <div className="space-y-2 border-border border-t pt-6">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
      <div className="space-y-4 pt-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-16 w-full max-w-96" />
        <Skeleton className="h-5 w-full max-w-96" />
        <div className="pt-4">
          {['start', 'payment', 'end'].map((event) => (
            <div key={event} className="flex min-h-20 gap-4 pb-6">
              <Skeleton className="size-7 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
    </section>
  );
}
