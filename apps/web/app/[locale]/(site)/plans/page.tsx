import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { PlanComparison } from '@/features/plans/components/plan-comparison';
import { PlansSkeleton } from '@/features/plans/components/plans-skeleton';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('plans');
  return {
    title: t('title'),
    description: t('description'),
    alternates: localeAlternates(await getLocale(), '/plans'),
  };
}

export default async function PlansPage() {
  const [t, locale] = await Promise.all([
    getTranslations('plans'),
    getLocale(),
  ]);
  return (
    <div className="space-y-8">
      <header className="max-w-2xl space-y-3">
        <h1 className="font-extrabold text-4xl tracking-tighter md:text-5xl">
          {t('title')}
        </h1>
        <p className="text-lg text-muted-foreground">{t('description')}</p>
        <p className="text-muted-foreground text-sm">{t('disclosure')}</p>
      </header>
      <Suspense fallback={<PlansSkeleton />}>
        <PlanComparison locale={locale} />
      </Suspense>
    </div>
  );
}
