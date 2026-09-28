import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const TOTAL_STEPS = 3;

type OnboardingStep = 1 | 2 | 3;

function StepProgress({ step }: { step: OnboardingStep }) {
  return (
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
  );
}

type StepLabel =
  | {
      step: OnboardingStep;
      /** Replaces "Step n of 3". */
      overline?: ReactNode;
    }
  | { step?: never; overline: ReactNode };

/**
 * Title and description on top of each auth form. The sign-up onboarding
 * steps also show their progress; pages outside it (sign-in, password
 * reset) pass an `overline` instead of a `step`.
 */
export function StepHeader({
  title,
  description,
  ...label
}: {
  title: ReactNode;
  description: ReactNode;
} & StepLabel) {
  const t = useTranslations('auth');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {label.step !== undefined && <StepProgress step={label.step} />}
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {label.step === undefined
            ? label.overline
            : (label.overline ??
              t('step', { current: label.step, total: TOTAL_STEPS }))}
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
