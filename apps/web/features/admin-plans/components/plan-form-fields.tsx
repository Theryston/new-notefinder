'use client';

import type { SaveAdminPlanBody } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import type { UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PlanCopyFields({
  register,
}: {
  register: UseFormRegister<SaveAdminPlanBody>;
}) {
  const t = useTranslations('adminPlans');
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(['en', 'pt-BR'] as const).map((locale) => (
        <fieldset key={locale} className="space-y-3 rounded-2xl border p-4">
          <legend className="px-1 font-semibold">
            {t(locale === 'en' ? 'english' : 'portuguese')}
          </legend>
          <Label htmlFor={`name-${locale}`}>{t('name')}</Label>
          <Input id={`name-${locale}`} {...register(`copy.${locale}.name`)} />
          <Label htmlFor={`description-${locale}`}>{t('description')}</Label>
          <textarea
            className="min-h-24 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            id={`description-${locale}`}
            {...register(`copy.${locale}.description`)}
          />
        </fieldset>
      ))}
    </div>
  );
}

export function PlanSettingsFields({
  register,
}: {
  register: UseFormRegister<SaveAdminPlanBody>;
}) {
  const t = useTranslations('adminPlans');
  return (
    <fieldset className="flex flex-wrap items-center gap-5">
      <div className="space-y-2">
        <Label htmlFor="display-order">{t('displayOrder')}</Label>
        <Input
          id="display-order"
          type="number"
          {...register('displayOrder', { valueAsNumber: true })}
        />
      </div>
      {(['published', 'saleEnabled'] as const).map((key) => (
        <Label key={key} className="flex min-h-10 items-center gap-2">
          <input type="checkbox" {...register(key)} />
          {t(key)}
        </Label>
      ))}
    </fieldset>
  );
}
