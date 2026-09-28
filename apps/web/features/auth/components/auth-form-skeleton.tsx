import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Stand-in for a step form while it reads the URL or the session: same
 * blocks as the header and fields, so nothing moves when it loads.
 */
export function AuthFormSkeleton({ fields }: { fields: number }) {
  const t = useTranslations('auth');

  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-1 w-26" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-4/5 rounded-xl sm:h-10" />
          <Skeleton className="h-5 w-full rounded-md" />
          <Skeleton className="h-5 w-2/3 rounded-md" />
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {Array.from({ length: fields }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders.
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ))}
        <Skeleton className="mt-1 h-12 w-full" />
      </div>
    </div>
  );
}
