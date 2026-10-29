import { z } from 'zod';
import { localeSchema } from './locales.js';
import { billingCycleSchema, planCurrencySchema } from './plans.js';

export const createCheckoutBodySchema = z.strictObject({
  planId: z.string().min(1),
  offerId: z.string().min(1),
  cycle: billingCycleSchema,
  locale: localeSchema,
  comingSoonAcknowledged: z.literal(true),
});
export type CreateCheckoutBody = z.infer<typeof createCheckoutBodySchema>;
export const checkoutResultSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('checkout'), url: z.url() }),
  z.object({ action: z.literal('manage') }),
]);
export type CheckoutResult = z.infer<typeof checkoutResultSchema>;
export const subscriptionSchema = z.object({
  planId: z.string(),
  planName: z.string(),
  cycle: billingCycleSchema,
  currency: planCurrencySchema,
  amount: z.number().int().positive(),
  status: z.enum(['pending', 'confirmed', 'unsuccessful']),
  providerStatus: z.string().nullable(),
  paidMembership: z.boolean(),
  currentPeriodStart: z.iso.datetime().nullable(),
  currentPeriodEnd: z.iso.datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  recoveryDeadline: z.iso.datetime().nullable().optional(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;
export const currentSubscriptionSchema = z.object({
  subscription: subscriptionSchema.nullable(),
});
export type CurrentSubscription = z.infer<typeof currentSubscriptionSchema>;

export const createPortalBodySchema = z.strictObject({ locale: localeSchema });
export type CreatePortalBody = z.infer<typeof createPortalBodySchema>;
export const portalSessionSchema = z.object({ url: z.url() });
export type PortalSession = z.infer<typeof portalSessionSchema>;
