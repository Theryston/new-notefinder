import type { Plan, PlanCurrency } from '@vozzify/contracts';
import { getTranslations } from 'next-intl/server';
import { CheckoutSelection } from './checkout-selection';
import { PlanBenefits } from './plan-benefits';

export async function PlanCard({
  plan,
  currency,
}: {
  plan: Plan;
  currency: PlanCurrency;
}) {
  const t = await getTranslations('plans');
  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      className="space-y-5 rounded-2xl bg-card p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id={`plan-${plan.id}`}
          className="font-bold text-2xl tracking-tight"
        >
          {plan.name}
        </h2>
        <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
          {t('nextStep')}
        </span>
      </div>
      <CheckoutSelection
        currency={currency}
        plan={{
          id: plan.id,
          name: plan.name,
          offers: plan.offers,
          saleAvailable: plan.saleAvailable,
        }}
      />
      <PlanBenefits benefits={plan.benefits} />
    </article>
  );
}
