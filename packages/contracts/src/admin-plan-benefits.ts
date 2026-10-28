import { z } from 'zod';
import { benefitStatusSchema, localizedCatalogCopySchema } from './plans.js';

export const writeBenefitBodySchema = z
  .object({
    copy: localizedCatalogCopySchema,
    status: benefitStatusSchema,
  })
  .strict();
export type WriteBenefitBody = z.infer<typeof writeBenefitBodySchema>;

export const benefitIdParamSchema = z.object({ benefitId: z.string().min(1) });
export type BenefitIdParam = z.infer<typeof benefitIdParamSchema>;
export const benefitPlanIdParamSchema = z.object({ planId: z.string().min(1) });
export type BenefitPlanIdParam = z.infer<typeof benefitPlanIdParamSchema>;

export const benefitPlanSchema = z.object({
  id: z.string().min(1),
  copy: localizedCatalogCopySchema,
  benefitIds: z.array(z.string().min(1)),
});
export type BenefitPlan = z.infer<typeof benefitPlanSchema>;
export const benefitPlansSchema = z.array(benefitPlanSchema);
export type BenefitPlans = z.infer<typeof benefitPlansSchema>;

export const adminBenefitSchema = writeBenefitBodySchema.extend({
  id: z.string().min(1),
  plans: z.array(benefitPlanSchema.pick({ id: true, copy: true })),
});
export type AdminBenefit = z.infer<typeof adminBenefitSchema>;
export const adminBenefitsSchema = z.array(adminBenefitSchema);
export type AdminBenefits = z.infer<typeof adminBenefitsSchema>;

export const setPlanBenefitsBodySchema = z
  .object({
    benefitIds: z.array(z.string().min(1)).max(200),
  })
  .strict()
  .refine(({ benefitIds }) => new Set(benefitIds).size === benefitIds.length, {
    path: ['benefitIds'],
    message: 'Benefits must be unique',
  });
export type SetPlanBenefitsBody = z.infer<typeof setPlanBenefitsBodySchema>;
