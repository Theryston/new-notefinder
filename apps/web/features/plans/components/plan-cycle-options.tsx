'use client';

import type {
  BillingCycle,
  PlanCurrency,
  PlanOffer,
} from '@notefinder/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { annualSavingsMonths } from '../plan-pricing';

type Props = {
  planId: string;
  offers: PlanOffer[];
  selected: PlanOffer;
  currency: PlanCurrency;
  disabled: boolean;
  onChange: (cycle: BillingCycle) => void;
};

export function PlanCycleOptions({
  planId,
  offers,
  selected,
  currency,
  disabled,
  onChange,
}: Props) {
  const t = useTranslations('plans');
  const format = useFormatter();
  const savings = annualSavingsMonths(offers);
  return (
    <fieldset
      disabled={disabled}
      aria-label={t('chooseCycle')}
      className="space-y-2"
    >
      {offers.map((offer) => (
        <label
          key={offer.id}
          className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 has-disabled:cursor-wait has-checked:border-foreground has-checked:bg-surface has-disabled:opacity-60"
        >
          <input
            type="radio"
            name={`plan-${planId}-cycle`}
            value={offer.cycle}
            checked={selected.id === offer.id}
            onChange={() => onChange(offer.cycle)}
            className="size-4 shrink-0 accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <span className="min-w-0 space-y-1">
            <span className="block font-semibold text-sm">
              {t(offer.cycle)}
            </span>
            <span className="block text-muted-foreground text-xs tabular-nums">
              {t(offer.cycle === 'annual' ? 'annualCharge' : 'monthlyCharge', {
                amount: format.number(offer.amount / 100, {
                  style: 'currency',
                  currency,
                }),
              })}
            </span>
          </span>
          {offer.cycle === 'annual' && savings > 0 ? (
            <span className="ml-auto max-w-20 text-right font-medium text-muted-foreground text-xs">
              {t('savingsMonths', { count: savings })}
            </span>
          ) : null}
        </label>
      ))}
    </fieldset>
  );
}
