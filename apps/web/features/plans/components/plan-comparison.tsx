import type { Locale } from '@notefinder/contracts';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';

import { getPlanCatalog } from '../queries';
import { PlanCard } from './plan-card';

export async function PlanComparison({ locale }: { locale: Locale }) {
  // A temporary catalog outage must not become a build-time error page.
  await connection();
  const t = await getTranslations('plans');
  const catalog = await getPlanCatalog(locale).catch(() => null);
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
    <div className="grid gap-6 lg:grid-cols-2">
      {catalog.plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} currency={catalog.currency} />
      ))}
    </div>
  );
}
