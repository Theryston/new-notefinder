import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const TOTAL_STEPS = 3;

/** Step progress, title and description on top of each auth form. */
export function StepHeader({
  step,
  title,
  description,
  overline,
}: {
  step: 1 | 2 | 3;
  title: ReactNode;
  description: ReactNode;
  /** Replaces the "Step n of 3" label. */
  overline?: ReactNode;
}) {
  const t = useTranslations('auth');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div aria-hidden="true" className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length list of identical segments.
              key={index}
              className={cn(
                'h-1 w-8 rounded-full transition-colors duration-200',
                index < step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {overline ?? t('step', { current: step, total: TOTAL_STEPS })}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-prose text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
