import type { AdminPlan } from '@vozzify/contracts';
import type { PlansRepository } from './plans.repository.js';

export function adminPlanOf(
  row: Awaited<ReturnType<PlansRepository['list']>>[number],
): AdminPlan {
  return {
    id: row.id,
    kind: row.kind,
    copy: row.copy,
    displayOrder: row.displayOrder,
    trialDays: row.trialDays,
    published: row.published,
    saleEnabled: row.saleEnabled,
    enabledCycles: row.enabledCycles,
    prices: row.prices.map(({ cycle, currency, amount }) => ({
      cycle,
      currency,
      amount,
    })),
    syncStatus: row.operation?.status ?? 'synced',
    pendingOperation: row.operation?.body ?? null,
    ...(row.priceMigrations ? { priceMigrations: row.priceMigrations } : {}),
  };
}
