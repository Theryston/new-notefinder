'use client';
import type { AdminPlan, SaveAdminPlanBody } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { planFormDefaults } from '../form';
import { planFormResolver } from '../form-resolver';
import { useSaveAdminPlan } from '../hooks/use-admin-plan-mutations';
import { PlanCopyFields, PlanSettingsFields } from './plan-form-fields';
import { PlanPriceFields } from './plan-price-fields';

export function PlanForm({
  plan,
  onClose,
}: {
  plan?: AdminPlan;
  onClose: () => void;
}) {
  const t = useTranslations('adminPlans');
  const errors = useTranslations('errors');
  const form = useForm<SaveAdminPlanBody>({
    defaultValues: planFormDefaults(plan),
    resolver: planFormResolver,
  });
  const save = useSaveAdminPlan({ planId: plan?.id, onSuccess: onClose });
  const submit = form.handleSubmit((values) => save.mutate(values));
  return (
    <form
      noValidate
      onSubmit={submit}
      className="space-y-6 rounded-2xl border bg-card p-4 md:p-6"
      aria-label={t('editPlan')}
    >
      <h2 className="font-bold text-xl">{t(plan ? 'editPlan' : 'newPlan')}</h2>
      {plan?.pendingOperation ? <p role="status">{t('pendingHelp')}</p> : null}
      <fieldset
        disabled={
          save.isPending || save.isError || plan?.pendingOperation != null
        }
        className="space-y-6"
      >
        <PlanCopyFields register={form.register} />
        <PlanSettingsFields register={form.register} />
        <PlanPriceFields form={form} />
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 ? (
        <p role="alert">{t('invalid')}</p>
      ) : null}
      {save.error ? (
        <p role="alert">
          {errors(
            save.error instanceof ApiError ? save.error.code : 'INTERNAL_ERROR',
          )}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={save.isPending}>
          {t(
            save.isPending
              ? 'saving'
              : save.isError || plan?.pendingOperation
                ? 'retry'
                : 'save',
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
