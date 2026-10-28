import type { Plan, PlanCatalog } from '@notefinder/contracts';
import { CheckIcon, ClockIcon } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { CheckoutSelection } from './checkout-selection';

type Props = { plan: Plan; currency: PlanCatalog['currency'] };

export async function PlanCard({ plan, currency }: Props) {
  const [t, format] = await Promise.all([
    getTranslations('plans'),
    getFormatter(),
  ]);
  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      className="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm md:p-8"
    >
      <div className="space-y-2">
        <h2
          id={`plan-${plan.id}`}
          className="font-bold text-2xl tracking-tight"
        >
          {plan.name}
        </h2>
        <p className="text-muted-foreground text-sm">{plan.description}</p>
      </div>
      <div className="space-y-2">
        {plan.kind === 'free' ? (
          <p className="font-bold text-3xl">{t('freePrice')}</p>
        ) : (
          plan.offers.map((offer) => (
            <p key={offer.id} className="font-semibold text-lg tabular-nums">
              {t(offer.cycle === 'annual' ? 'annualCharge' : 'monthlyCharge', {
                amount: format.number(offer.amount / 100, {
                  style: 'currency',
                  currency,
                }),
              })}
            </p>
          ))
        )}
        {plan.kind === 'paid' ? (
          <p className="text-muted-foreground text-sm">
            {plan.offers.length === 0
              ? t('noOffers')
              : t('currency', { currency })}
          </p>
        ) : null}
      </div>
      <ul className="flex flex-col gap-4">
        {plan.benefits.map((benefit) => (
          <li key={benefit.id} className="flex items-start gap-3">
            {benefit.status === 'coming-soon' ? (
              <ClockIcon
                aria-hidden
                className="mt-1 size-4 shrink-0 text-muted-foreground"
              />
            ) : (
              <CheckIcon aria-hidden className="mt-1 size-4 shrink-0" />
            )}
            <div className="space-y-1">
              <p className="font-semibold text-sm">{benefit.name}</p>
              <p className="font-medium text-muted-foreground text-xs">
                {t(
                  benefit.status === 'coming-soon' ? 'comingSoon' : 'available',
                )}
              </p>
              <p className="text-muted-foreground text-sm">
                {benefit.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-2">
        {plan.kind === 'free' ? (
          <Link
            href="/search"
            className={buttonVariants({ variant: 'default' })}
          >
            {t('startSinging')}
          </Link>
        ) : (
          <>
            <CheckoutSelection plan={plan} />
            {plan.saleAvailable !== true ? (
              <p className="text-muted-foreground text-sm">
                {t(
                  plan.saleAvailable === false
                    ? 'salesPaused'
                    : 'checkoutPending',
                )}
              </p>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
