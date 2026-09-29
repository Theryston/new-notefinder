import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';

function FieldSkeleton({ hint = false }: { hint?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-10 w-full" />
      {hint && <Skeleton className="h-4 w-3/5" />}
    </div>
  );
}

/**
 * Stand-in for the edit form while the session loads: the same blocks
 * (summary, fields, save button), so nothing moves when it arrives.
 */
export function EditProfileSkeleton() {
  const t = useTranslations('profile.edit');

  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-20" />
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <Skeleton className="h-7 w-40 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </div>
        </div>
      </div>
      <FieldSkeleton />
      <FieldSkeleton hint />
      <FieldSkeleton />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
      </div>
      <Skeleton className="h-12 w-full sm:w-40" />
    </div>
  );
}
