import type { Subscription } from '@vozzify/contracts';
import { describe, expect, it } from 'vitest';
import { subscriptionState } from './subscription-presentation';

const ended: Subscription = {
  planId: 'pro',
  planName: 'Pro',
  cycle: 'monthly',
  currency: 'USD',
  amount: 350,
  status: 'confirmed',
  providerStatus: 'canceled',
  paidMembership: false,
  currentPeriodStart: '2026-10-01T00:00:00.000Z',
  currentPeriodEnd: '2026-11-01T00:00:00.000Z',
  cancelAtPeriodEnd: true,
};

describe('ended paid cancellation', () => {
  it('distinguishes an expired paid period from an unsuccessful payment', () => {
    expect(subscriptionState(ended)).toBe('ended');
    expect(subscriptionState({ ...ended, cancelAtPeriodEnd: false })).toBe(
      'unsuccessful',
    );
    expect(subscriptionState({ ...ended, status: 'unsuccessful' })).toBe(
      'unsuccessful',
    );
  });
});
