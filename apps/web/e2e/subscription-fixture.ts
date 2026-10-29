import type { Subscription } from '@vozzify/contracts';

export function subscriptionFixture(
  overrides: Partial<Subscription> = {},
): Subscription {
  return {
    planId: 'pro',
    planName: 'Pro',
    cycle: 'monthly',
    currency: 'USD',
    amount: 350,
    status: 'confirmed',
    providerStatus: 'active',
    paidMembership: true,
    currentPeriodStart: '2026-10-28T12:00:00.000Z',
    currentPeriodEnd: '2026-11-28T12:00:00.000Z',
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}
