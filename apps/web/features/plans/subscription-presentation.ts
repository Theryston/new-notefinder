import type { Subscription } from '@notefinder/contracts';

export function subscriptionState(subscription: Subscription | null) {
  if (!subscription) return 'free';
  if (subscription.status !== 'confirmed') return subscription.status;
  if (!subscription.paidMembership) return 'unsuccessful';
  return subscription.cancelAtPeriodEnd ? 'ending' : 'active';
}
