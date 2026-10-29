import type { Subscription } from '@vozzify/contracts';

export function subscriptionState(subscription: Subscription | null) {
  if (!subscription) return 'free';
  if (subscription.status !== 'confirmed') return subscription.status;
  if (!subscription.paidMembership)
    return subscription.cancelAtPeriodEnd ? 'ended' : 'unsuccessful';
  return subscription.cancelAtPeriodEnd ? 'ending' : 'active';
}
