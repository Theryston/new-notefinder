'use client';
import type { AdminPlan } from '@vozzify/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { useContractingMutation } from '../hooks/use-admin-plan-mutations';
import { useAdminPlans } from '../hooks/use-admin-plans';
import { AdminPlansSkeleton } from './admin-plans-skeleton';
import { PlanForm } from './plan-form';

export function PlansPanel() {
  const t = useTranslations('adminPlans');
  const errors = useTranslations('errors');
  const [editing, setEditing] = useState<AdminPlan | 'new' | null>(null);
  const catalog = useAdminPlans();
  const contracting = useContractingMutation();
  if (catalog.isPending) return <AdminPlansSkeleton />;
  if (catalog.error)
    return (
      <div role="alert">
        <p>
          {errors(
            catalog.error instanceof ApiError
              ? catalog.error.code
              : 'INTERNAL_ERROR',
          )}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void catalog.refetch();
          }}
        >
          {t('retry')}
        </Button>
      </div>
    );
  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex min-h-10 items-center gap-3">
          <input
            type="checkbox"
            checked={catalog.data.contractingEnabled}
            disabled={contracting.isPending}
            onChange={(event) => contracting.mutate(event.target.checked)}
          />
          {t('contractingEnabled')}
        </label>
        <Button onClick={() => setEditing('new')}>{t('newPlan')}</Button>
      </div>
      <p className="text-muted-foreground text-sm">{t('testMode')}</p>
      {contracting.error ? (
        <p role="alert">
          {errors(
            contracting.error instanceof ApiError
              ? contracting.error.code
              : 'INTERNAL_ERROR',
          )}
        </p>
      ) : null}
      {editing ? (
        <PlanForm
          key={editing === 'new' ? 'new' : editing.id}
          {...(editing === 'new' ? {} : { plan: editing })}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <PlanList plans={catalog.data.plans} onEdit={setEditing} />
    </div>
  );
}

function PlanList({
  plans,
  onEdit,
}: {
  plans: AdminPlan[];
  onEdit: (plan: AdminPlan) => void;
}) {
  const t = useTranslations('adminPlans');
  if (plans.length === 0) return <p>{t('empty')}</p>;
  return (
    <ul className="space-y-3">
      {plans.map((plan) => (
        <PlanListItem key={plan.id} plan={plan} onEdit={onEdit} />
      ))}
    </ul>
  );
}

function PlanListItem({
  plan,
  onEdit,
}: {
  plan: AdminPlan;
  onEdit: (plan: AdminPlan) => void;
}) {
  const t = useTranslations('adminPlans');
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="font-bold text-lg">{plan.copy.en.name}</h2>
        <p className="text-muted-foreground text-sm">
          {t(plan.published ? 'publishedStatus' : 'draftStatus')} ·{' '}
          {t(plan.saleEnabled ? 'saleOn' : 'saleOff')}
        </p>
        {plan.pendingOperation ? (
          <p role="status">
            {t(plan.syncStatus === 'failed' ? 'failed' : 'pending')}
          </p>
        ) : null}
      </div>
      {plan.kind === 'paid' ? (
        <Button variant="outline" onClick={() => onEdit(plan)}>
          {t('edit', { name: plan.copy.en.name })}
        </Button>
      ) : null}
    </li>
  );
}
