import { adminPlanCatalogSchema, adminPlanSchema } from '@vozzify/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browserApi } from '@/lib/api/browser';
import { fetchAdminPlans, saveAdminPlan, setContracting } from './client';
import { planFormDefaults } from './form';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

describe('Admin catalog requests', () => {
  beforeEach(() => {
    vi.mocked(browserApi).mockResolvedValue({});
  });
  it('reads private admin data with cancellation', async () => {
    const signal = new AbortController().signal;
    await fetchAdminPlans(signal);
    expect(browserApi).toHaveBeenCalledWith('/admin/plans', {
      schema: adminPlanCatalogSchema,
      signal,
    });
  });
  it('sends shared contract data and retains operation IDs on retry', async () => {
    const body = planFormDefaults();
    await saveAdminPlan(body);
    expect(browserApi).toHaveBeenCalledWith('/admin/plans', {
      method: 'POST',
      schema: adminPlanSchema,
      body,
    });
    await saveAdminPlan(body, 'studio/id');
    expect(browserApi).toHaveBeenLastCalledWith('/admin/plans/studio%2Fid', {
      method: 'PUT',
      schema: adminPlanSchema,
      body,
    });
  });
  it('changes the global sales control through its admin endpoint', async () => {
    await setContracting(true);
    expect(browserApi).toHaveBeenCalledWith('/admin/plans/contracting', {
      method: 'PUT',
      schema: adminPlanCatalogSchema,
      body: { contractingEnabled: true },
    });
  });
});
