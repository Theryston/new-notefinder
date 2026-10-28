'use client';

import type { AdminBenefit } from '@vozzify/contracts';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { isLocale } from '@/lib/i18n/routing';
import { useBenefitCatalog } from '../hooks/use-benefit-catalog';
import { BenefitsSkeleton } from './benefits-skeleton';
import { PlanBenefitEditor } from './plan-benefit-editor';

const BenefitForm = dynamic(() =>
  import('./benefit-form').then((module) => module.BenefitForm),
);
const DeleteBenefitDialog = dynamic(() =>
  import('./delete-benefit-dialog').then(
    (module) => module.DeleteBenefitDialog,
  ),
);

export function BenefitsPanel() {
  const t = useTranslations('adminBenefits');
  const pageLocale = useLocale();
  const locale = isLocale(pageLocale) ? pageLocale : 'en';
  const catalog = useBenefitCatalog();
  const [editing, setEditing] = useState<AdminBenefit | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminBenefit | null>(null);
  if (catalog.benefits.isPending || catalog.plans.isPending)
    return <BenefitsSkeleton />;
  if (catalog.benefits.isError || catalog.plans.isError)
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{t('loadError')}</p>
        <Button
          variant="outline"
          onClick={() => {
            void catalog.benefits.refetch();
            void catalog.plans.refetch();
          }}
        >
          {t('retry')}
        </Button>
      </div>
    );
  const benefits = catalog.benefits.data;
  return (
    <div className="flex flex-col gap-8 py-6">
      <Toaster />
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>{t('create')}</Button>
      </div>
      {benefits.length === 0 && (
        <p className="text-muted-foreground">{t('empty')}</p>
      )}
      <ul className="flex flex-col gap-3">
        {benefits.map((benefit) => (
          <li
            key={benefit.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5"
          >
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">{benefit.copy[locale].name}</h2>
              <p className="text-muted-foreground text-sm">
                {benefit.copy[locale].description}
              </p>
              <span className="text-sm">{t(`statuses.${benefit.status}`)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(benefit)}>
                {t('edit')}
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(benefit)}>
                {t('delete')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <h2 className="font-bold text-xl tracking-tight">{t('planBenefits')}</h2>
      {catalog.plans.data.length === 0 && <p>{t('noPlans')}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {catalog.plans.data.map((plan) => (
          <PlanBenefitEditor
            key={`${plan.id}:${plan.benefitIds.join(',')}`}
            plan={plan}
            benefits={benefits}
            link={catalog.link}
          />
        ))}
      </div>
      {editing !== null && (
        <BenefitForm
          {...(editing === 'new' ? {} : { benefit: editing })}
          save={catalog.save}
          close={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteBenefitDialog
          benefit={deleting}
          remove={catalog.remove}
          close={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
