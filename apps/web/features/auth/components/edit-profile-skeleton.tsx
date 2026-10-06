import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function SectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-36 rounded-md" />
      {children}
    </div>
  );
}

/** Mirrors `AccountRow`: a `value` row stacks below `sm`, an `action` one doesn't. */
function AccountRowSkeleton({
  caption,
  layout = 'value',
}: {
  caption?: string;
  layout?: 'value' | 'action';
}) {
  return (
    <div className="flex min-h-14 flex-col justify-center gap-1 px-4 py-3">
      <div
        className={cn(
          'flex gap-1',
          layout === 'value'
            ? 'flex-col sm:flex-row sm:items-center sm:justify-between'
            : 'items-center justify-between',
        )}
      >
        <Skeleton className="h-4.5 w-28 rounded-md" />
        <Skeleton className="h-5 w-32 rounded-md" />
      </div>
      {caption && <Skeleton className={cn('w-3/5 rounded-md', caption)} />}
    </div>
  );
}

/**
 * Stand-in for the edit form while the session loads: the same blocks
 * (Profile section, then the account card) in the same grid, so nothing
 * moves when it arrives.
 */
export function EditProfileSkeleton() {
  const t = useTranslations('profile.edit');

  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-12"
    >
      <SectionSkeleton>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <Skeleton className="size-24 sm:size-20" />
            <div className="flex flex-col items-center gap-1.5 sm:items-start">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48 rounded-md" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4.5 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-12 w-full sm:w-40" />
        </div>
      </SectionSkeleton>
      <SectionSkeleton>
        <div className="divide-y divide-border rounded-2xl bg-card shadow-sm">
          {/* The username hint wraps to two lines on a phone. */}
          <AccountRowSkeleton caption="h-9 sm:h-4.5" />
          <AccountRowSkeleton />
          <AccountRowSkeleton layout="action" caption="h-4.5" />
        </div>
      </SectionSkeleton>
    </div>
  );
}
