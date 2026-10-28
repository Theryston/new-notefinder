import type { Locale, PlanCatalog } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { FreePlan } from './free-plan';
import { PlanCard } from './plan-card';

export async function PlanComparison({
  locale,
  catalog,
}: {
  locale: Locale;
  catalog: PlanCatalog | null;
}) {
  const t = await getTranslations('plans');
  const { billing, plans } = await getMessages();
  if (!catalog) {
    return (
      <div role="alert" className="rounded-2xl bg-muted p-8 text-center">
        <p>{t('error')}</p>
        <a
          href={`/${locale}/plans`}
          className="mt-4 inline-flex min-h-10 items-center underline underline-offset-4"
        >
          {t('retry')}
        </a>
      </div>
    );
  }
  if (catalog.plans.length === 0) {
    return (
      <p className="rounded-2xl bg-muted p-8 text-center text-muted-foreground">
        {t('empty')}
      </p>
    );
  }
  return (
    <NextIntlClientProvider messages={{ billing, plans }}>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)] lg:gap-16">
        <div className="order-2 space-y-8 lg:order-1">
          {catalog.plans
            .filter((plan) => plan.kind === 'free')
            .map((plan) => (
              <FreePlan key={plan.id} plan={plan} />
            ))}
        </div>
        <div className="order-1 space-y-6 lg:order-2">
          {catalog.plans
            .filter((plan) => plan.kind === 'paid')
            .map((plan) => (
              <PlanCard key={plan.id} plan={plan} currency={catalog.currency} />
            ))}
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
