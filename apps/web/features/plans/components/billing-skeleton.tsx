import { Skeleton } from '@/components/ui/skeleton';

export function BillingSkeleton({
  checkout = false,
  label,
}: {
  checkout?: boolean;
  label: string;
}) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="max-w-xl space-y-6 rounded-2xl bg-card p-6 shadow-sm"
    >
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-6 w-2/3" />
      {[
        'plan',
        'terms',
        'dates',
        'status',
        ...(checkout ? ['benefits', 'disclosure', 'payment'] : []),
      ].map((row) => (
        <Skeleton key={row} className="h-6 w-full" />
      ))}
      <Skeleton className="h-10 w-48 rounded-full" />
    </section>
  );
}
