import type { Subscription } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';
import { subscriptionState } from './subscription-presentation';

const subscription: Subscription = {
  planId: 'pro',
  planName: 'Pro',
  cycle: 'monthly',
  amount: 1990,
  currency: 'BRL',
  status: 'confirmed',
  providerStatus: 'active',
  paidMembership: true,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

describe('subscriptionState', () => {
  it('shows the free state without a paid contract', () => {
    expect(subscriptionState(null)).toBe('free');
  });
  it('distinguishes renewal from scheduled cancellation', () => {
    expect(subscriptionState(subscription)).toBe('active');
    expect(
      subscriptionState({ ...subscription, cancelAtPeriodEnd: true }),
    ).toBe('ending');
  });
  it('does not claim active membership without paid access', () => {
    expect(subscriptionState({ ...subscription, paidMembership: false })).toBe(
      'unsuccessful',
    );
  });
  it.each(['pending', 'unsuccessful'] as const)(
    'preserves the %s payment state even with cancellation scheduled',
    (status) => {
      expect(
        subscriptionState({ ...subscription, status, cancelAtPeriodEnd: true }),
      ).toBe(status);
    },
  );
});
