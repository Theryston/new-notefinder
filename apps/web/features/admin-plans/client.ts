import {
  adminPlanCatalogSchema,
  adminPlanSchema,
  type SaveAdminPlanBody,
} from '@vozzify/contracts';
import { browserApi } from '@/lib/api/browser';

export function fetchAdminPlans(signal?: AbortSignal) {
  return browserApi('/admin/plans', { schema: adminPlanCatalogSchema, signal });
}

export function saveAdminPlan(body: SaveAdminPlanBody, planId?: string) {
  return browserApi(
    planId ? `/admin/plans/${encodeURIComponent(planId)}` : '/admin/plans',
    {
      method: planId ? 'PUT' : 'POST',
      schema: adminPlanSchema,
      body,
    },
  );
}

export function setContracting(contractingEnabled: boolean) {
  return browserApi('/admin/plans/contracting', {
    method: 'PUT',
    schema: adminPlanCatalogSchema,
    body: { contractingEnabled },
  });
}
