import type { PlanBenefit } from '@vozzify/contracts';
import { CheckIcon, ClockIcon, InfoIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function PlanBenefits({ benefits }: { benefits: PlanBenefit[] }) {
  const t = await getTranslations('plans');
  const available = benefits.filter(
    (benefit) => benefit.status === 'available',
  );
  const upcoming = benefits.filter(
    (benefit) => benefit.status === 'coming-soon',
  );
  return (
    <div className="space-y-5">
      {available.length > 0 ? (
        <BenefitList benefits={available} />
      ) : (
        <p className="flex items-center justify-center gap-2 text-sm">
          <CheckIcon aria-hidden className="size-4" />
          {t('includesFree')}
        </p>
      )}
      {upcoming.length > 0 ? (
        <details open className="border-border border-t pt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span className="space-y-1">
              <span className="block font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                {t('comingNext')}
              </span>
              <span className="block text-muted-foreground text-xs">
                {t('upcomingCount', { count: upcoming.length })}
              </span>
            </span>
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
              <ClockIcon aria-hidden className="size-3" />
              {t('comingSoon')}
            </span>
          </summary>
          <div className="pt-5">
            <BenefitList benefits={upcoming} compact />
          </div>
        </details>
      ) : null}
      {upcoming.length > 0 ? (
        <p className="flex items-start gap-2 border-border border-t pt-4 text-muted-foreground text-xs leading-relaxed">
          <InfoIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {t('upcomingDisclosure')}
        </p>
      ) : null}
    </div>
  );
}

export async function BenefitList({
  benefits,
  compact = false,
}: {
  benefits: PlanBenefit[];
  compact?: boolean;
}) {
  const t = await getTranslations('plans');
  return (
    <ul className={compact ? 'grid grid-cols-2 gap-x-4 gap-y-3' : 'space-y-3'}>
      {benefits.map((benefit) => (
        <li
          key={benefit.id}
          className="flex items-start gap-2 text-sm"
          title={benefit.description}
        >
          {benefit.status === 'coming-soon' ? (
            <ClockIcon
              aria-hidden
              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            />
          ) : (
            <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          <span
            className={
              compact
                ? 'text-muted-foreground text-xs leading-relaxed'
                : undefined
            }
          >
            <span>{benefit.name}</span>
            <span className="sr-only">
              {t(benefit.status === 'available' ? 'available' : 'comingSoon')}.{' '}
              {benefit.description}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
