import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getLocale, getTranslations } from 'next-intl/server';

import { PlanComparison } from '@/features/plans/components/plan-comparison';
import { getPlanCatalog } from '@/features/plans/queries';
import { localeAlternates } from '@/lib/i18n/metadata';

// Catalog-controlled copy and benefit counts have no fixed placeholder geometry.
// Wait for the actual comparison so its first paint already has its final layout.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('plans');
  return {
    title: t('title'),
    description: t('description'),
    alternates: localeAlternates(await getLocale(), '/plans'),
  };
}

export default async function PlansPage() {
  await connection();
  const [t, locale] = await Promise.all([
    getTranslations('plans'),
    getLocale(),
  ]);
  const catalog = await getPlanCatalog(locale).catch(() => null);
  return (
    <div className="space-y-8">
      <header className="max-w-2xl space-y-3">
        <h1 className="font-extrabold text-4xl tracking-tighter md:text-5xl">
          {t('title')}
        </h1>
        <p className="text-lg text-muted-foreground">{t('description')}</p>
        <p className="text-muted-foreground text-sm">{t('disclosure')}</p>
      </header>
      <PlanComparison locale={locale} catalog={catalog} />
    </div>
  );
}
