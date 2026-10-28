import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminPlansSkeleton() {
  const t = useTranslations('adminPlans');
  return (
    <div role="status" aria-label={t('loading')} className="space-y-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-56 rounded-full" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <Skeleton className="h-5 w-full max-w-lg" />
      <div className="space-y-3">
        {['free', 'paid'].map((id) => (
          <Skeleton key={id} className="h-21 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
