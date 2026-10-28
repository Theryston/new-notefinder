import type { AdminPlan } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';
import { planFormDefaults } from './form';

const plan: AdminPlan = {
  id: 'studio',
  kind: 'paid',
  copy: {
    en: { name: 'Studio', description: 'Practice tools.' },
    'pt-BR': { name: 'Studio BR', description: 'Localized tools.' },
  },
  displayOrder: 2,
  published: true,
  saleEnabled: true,
  enabledCycles: ['annual'],
  prices: [{ cycle: 'annual', currency: 'USD', amount: 4800 }],
  syncStatus: 'synced',
  pendingOperation: null,
};

describe('Plan editor operation identities', () => {
  it('starts a localized unpublished draft with a new identity per edit', () => {
    const first = planFormDefaults();
    const second = planFormDefaults();
    expect(first.operationId).not.toBe(second.operationId);
    expect(first).toMatchObject({
      copy: {
        en: { name: '', description: '' },
        'pt-BR': { name: '', description: '' },
      },
      published: false,
      saleEnabled: false,
      prices: [],
      enabledCycles: ['monthly', 'annual'],
    });
  });
  it('copies existing settings without substituting currencies or cycles', () => {
    expect(planFormDefaults(plan)).toMatchObject({
      copy: plan.copy,
      prices: plan.prices,
      enabledCycles: ['annual'],
      published: true,
      displayOrder: 2,
    });
  });
  it('resumes the exact saved operation after failure rather than creating another', () => {
    const operation = planFormDefaults(plan);
    const failed = {
      ...plan,
      syncStatus: 'failed' as const,
      pendingOperation: operation,
    };
    expect(planFormDefaults(failed)).toBe(operation);
  });
});
