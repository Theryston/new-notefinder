'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AdminBenefit,
  type WriteBenefitBody,
  writeBenefitBodySchema,
} from '@vozzify/contracts';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  FormField,
  fieldErrorProps,
} from '@/features/auth/components/form-field';
import type { useBenefitCatalog } from '../hooks/use-benefit-catalog';

const empty: WriteBenefitBody = {
  status: 'coming-soon',
  copy: {
    en: { name: '', description: '' },
    'pt-BR': { name: '', description: '' },
  },
};
type FormProps = {
  benefit?: AdminBenefit;
  save: ReturnType<typeof useBenefitCatalog>['save'];
  close: () => void;
};

export function BenefitForm({ benefit, save, close }: FormProps) {
  const t = useTranslations('adminBenefits');
  const form = useForm<WriteBenefitBody>({
    resolver: zodResolver(writeBenefitBodySchema),
    defaultValues: benefit
      ? { copy: benefit.copy, status: benefit.status }
      : empty,
  });
  const submit = form.handleSubmit(async (body) => {
    try {
      await save.mutateAsync({ body, ...(benefit ? { id: benefit.id } : {}) });
      close();
    } catch {
      /* The mutation displays the translated error. */
    }
  });
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent closeLabel={t('cancel')} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(benefit ? 'edit' : 'create')}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-4"
        >
          <CopyFields form={form} />
          <FormField id="benefit-status" label={t('status')}>
            <select
              id="benefit-status"
              className="h-10 rounded-full border bg-background px-3"
              {...form.register('status')}
            >
              {(['available', 'coming-soon', 'hidden'] as const).map(
                (status) => (
                  <option key={status} value={status}>
                    {t(`statuses.${status}`)}
                  </option>
                ),
              )}
            </select>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t('cancel')}
            </Button>
            <Button disabled={save.isPending} type="submit">
              {t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CopyFields({
  form,
}: {
  form: ReturnType<typeof useForm<WriteBenefitBody>>;
}) {
  const t = useTranslations('adminBenefits');
  return (['en', 'pt-BR'] as const).map((locale) => (
    <fieldset key={locale} className="flex flex-col gap-3">
      <legend className="mb-2 font-semibold">{t(`locales.${locale}`)}</legend>
      {(['name', 'description'] as const).map((field) => {
        const id = `benefit-${locale}-${field}`;
        const error = form.formState.errors.copy?.[locale]?.[field];
        return (
          <FormField
            key={field}
            id={id}
            label={t(field === 'description' ? 'descriptionField' : 'name')}
            error={error ? t('invalidCopy') : undefined}
          >
            <Input
              id={id}
              {...form.register(`copy.${locale}.${field}`)}
              {...fieldErrorProps(id, Boolean(error))}
            />
          </FormField>
        );
      })}
    </fieldset>
  ));
}
