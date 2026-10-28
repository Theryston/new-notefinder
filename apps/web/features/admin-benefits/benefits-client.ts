import {
  adminBenefitSchema,
  adminBenefitsSchema,
  benefitPlanSchema,
  benefitPlansSchema,
  type WriteBenefitBody,
} from '@notefinder/contracts';
import { z } from 'zod';
import { browserApi } from '@/lib/api/browser';

export function fetchBenefits(signal?: AbortSignal) {
  return browserApi('/admin/benefits', { schema: adminBenefitsSchema, signal });
}
export function fetchBenefitPlans(signal?: AbortSignal) {
  return browserApi('/admin/plan-benefits', {
    schema: benefitPlansSchema,
    signal,
  });
}
export function saveBenefit(body: WriteBenefitBody, id?: string) {
  return browserApi(
    id ? `/admin/benefits/${encodeURIComponent(id)}` : '/admin/benefits',
    {
      method: id ? 'PATCH' : 'POST',
      schema: adminBenefitSchema,
      body,
    },
  );
}
export function deleteBenefit(id: string) {
  return browserApi(`/admin/benefits/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    schema: z.undefined(),
  });
}
export function savePlanBenefits(planId: string, benefitIds: string[]) {
  return browserApi(`/admin/plan-benefits/${encodeURIComponent(planId)}`, {
    method: 'PUT',
    schema: benefitPlanSchema,
    body: { benefitIds },
  });
}
export function fetchBenefit(id: string) {
  return browserApi(`/admin/benefits/${encodeURIComponent(id)}`, {
    schema: adminBenefitSchema,
  });
}
