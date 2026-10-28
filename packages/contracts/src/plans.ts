import { z } from 'zod';
import { localeSchema } from './locales.js';

export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export const billingCycleSchema = z.enum(BILLING_CYCLES);
export type BillingCycle = z.infer<typeof billingCycleSchema>;

export const PLAN_CURRENCIES = ['BRL', 'USD'] as const;
export const planCurrencySchema = z.enum(PLAN_CURRENCIES);
export type PlanCurrency = z.infer<typeof planCurrencySchema>;

export const BENEFIT_STATUSES = ['available', 'coming-soon', 'hidden'] as const;
export const benefitStatusSchema = z.enum(BENEFIT_STATUSES);
export type BenefitStatus = z.infer<typeof benefitStatusSchema>;

const catalogCopySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
});

/** English is the source content; every published entry needs both locales. */
export const localizedCatalogCopySchema = z.record(
  localeSchema,
  catalogCopySchema,
);
export type LocalizedCatalogCopy = z.infer<typeof localizedCatalogCopySchema>;

export const planBenefitSchema = catalogCopySchema.extend({
  id: z.string().min(1),
  status: z.enum(['available', 'coming-soon']),
});
export type PlanBenefit = z.infer<typeof planBenefitSchema>;

export const planOfferSchema = z.object({
  id: z.string().min(1),
  cycle: billingCycleSchema,
  amount: z.number().int().positive(),
});
export type PlanOffer = z.infer<typeof planOfferSchema>;

export const planSchema = catalogCopySchema.extend({
  id: z.string().min(1),
  kind: z.enum(['free', 'paid']),
  trialDays: z.number().int().nonnegative(),
  saleAvailable: z.boolean().optional(),
  offers: z.array(planOfferSchema),
  benefits: z.array(planBenefitSchema),
});
export type Plan = z.infer<typeof planSchema>;

export const listPlansQuerySchema = z.object({
  locale: localeSchema.default('en'),
});
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;

/** Public presentation only: membership and checkout are separate resources. */
export const planCatalogSchema = z.object({
  currency: planCurrencySchema,
  plans: z.array(planSchema),
});
export type PlanCatalog = z.infer<typeof planCatalogSchema>;
