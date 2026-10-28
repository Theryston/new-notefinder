'use client';

import type { PlanCurrency, PlanOffer } from '@vozzify/contracts';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { monthlyPlanAmount } from '../plan-pricing';

export function PlanPrice({
  offer,
  currency,
}: {
  offer: PlanOffer;
  currency: PlanCurrency;
}) {
  const t = useTranslations('plans');
  const format = useFormatter();
  const locale = useLocale();
  const symbol =
    new Intl.NumberFormat(locale, { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency;
  return (
    <div className="space-y-2" data-testid="plan-price">
      <p className="flex items-baseline gap-1 font-extrabold text-5xl tabular-nums tracking-tighter">
        <span className="mr-1 font-semibold text-xl tracking-tight">
          {symbol}
        </span>
        <span>
          {format.number(monthlyPlanAmount(offer) / 100, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span className="ml-1 font-normal text-muted-foreground text-sm tracking-normal">
          {t('perMonth')}
        </span>
      </p>
      <p className="text-muted-foreground text-xs tabular-nums">
        {t(offer.cycle === 'annual' ? 'annualCharge' : 'monthlyCharge', {
          amount: format.number(offer.amount / 100, {
            style: 'currency',
            currency,
          }),
        })}
      </p>
    </div>
  );
}
