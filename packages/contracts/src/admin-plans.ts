import { z } from 'zod';
import {
  billingCycleSchema,
  localizedCatalogCopySchema,
  planCurrencySchema,
} from './plans.js';

export const adminPlanPriceSchema = z.object({
  cycle: billingCycleSchema,
  currency: planCurrencySchema,
  amount: z.number().int().positive().max(99_999_999),
});
export type AdminPlanPrice = z.infer<typeof adminPlanPriceSchema>;

export const saveAdminPlanBodySchema = z
  .object({
    operationId: z.uuid(),
    copy: localizedCatalogCopySchema,
    displayOrder: z.number().int(),
    trialDays: z.number().int().min(0).max(730).optional(),
    published: z.boolean(),
    saleEnabled: z.boolean(),
    enabledCycles: z.array(billingCycleSchema).max(2),
    prices: z.array(adminPlanPriceSchema).max(4),
  })
  .superRefine((body, ctx) => {
    if (new Set(body.enabledCycles).size !== body.enabledCycles.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['enabledCycles'],
        message: 'Duplicate cycle',
      });
    }
    const keys = body.prices.map((price) => `${price.cycle}:${price.currency}`);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['prices'],
        message: 'Duplicate offer',
      });
    }
    if (!body.published) return;
    if (body.enabledCycles.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['enabledCycles'],
        message: 'A published paid plan needs a cycle',
      });
    }
    for (const cycle of body.enabledCycles) {
      for (const currency of ['BRL', 'USD']) {
        if (!keys.includes(`${cycle}:${currency}`)) {
          ctx.addIssue({
            code: 'custom',
            path: ['prices'],
            message: 'Both currencies are required for every published cycle',
          });
        }
      }
    }
  });
export type SaveAdminPlanBody = z.infer<typeof saveAdminPlanBodySchema>;
export const adminPlanSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['free', 'paid']),
  copy: localizedCatalogCopySchema,
  displayOrder: z.number().int(),
  trialDays: z.number().int().min(0).max(730).optional(),
  published: z.boolean(),
  saleEnabled: z.boolean(),
  enabledCycles: z.array(billingCycleSchema),
  prices: z.array(adminPlanPriceSchema),
  syncStatus: z.enum(['synced', 'pending', 'failed']),
  pendingOperation: saveAdminPlanBodySchema.nullable(),
  priceMigrations: z
    .object({
      pending: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      uncertain: z.number().int().nonnegative().optional(),
    })
    .optional(),
});
export type AdminPlan = z.infer<typeof adminPlanSchema>;
export const adminPlanCatalogSchema = z.object({
  contractingEnabled: z.boolean(),
  plans: z.array(adminPlanSchema),
});
export type AdminPlanCatalog = z.infer<typeof adminPlanCatalogSchema>;
export const updateContractingBodySchema = z.object({
  contractingEnabled: z.boolean(),
});
export type UpdateContractingBody = z.infer<typeof updateContractingBodySchema>;
export const adminPlanIdParamSchema = z.object({
  planId: z.string().min(1).max(100),
});

export type AdminPlanIdParam = z.infer<typeof adminPlanIdParamSchema>;
