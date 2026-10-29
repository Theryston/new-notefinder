import type { AdminPlan, SaveAdminPlanBody } from '@vozzify/contracts';

export function planFormDefaults(plan?: AdminPlan): SaveAdminPlanBody {
  if (plan?.pendingOperation) return plan.pendingOperation;
  return {
    operationId: crypto.randomUUID(),
    copy: plan?.copy ?? {
      en: { name: '', description: '' },
      'pt-BR': { name: '', description: '' },
    },
    displayOrder: plan?.displayOrder ?? 0,
    trialDays: plan?.trialDays ?? 0,
    published: plan?.published ?? false,
    saleEnabled: plan?.saleEnabled ?? false,
    enabledCycles: plan?.enabledCycles ?? ['monthly', 'annual'],
    prices: plan?.prices ?? [],
  };
}
