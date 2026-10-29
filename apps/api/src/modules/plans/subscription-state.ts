import type { Subscription } from '@vozzify/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import type { StripeSubscription } from '../../integrations/stripe/stripe-billing.service.js';
import { isAgreedTrial } from './trial-terms.js';

type Contract = {
  stripeSubscriptionId: string | null;
  stripePriceId: string;
  amount: number;
  currency: string;
  cancelAtPeriodEnd?: boolean;
  trialDays?: number;
};
export function confirmedSubscription(input: {
  contract: Contract;
  customer: string;
  provider: StripeSubscription;
}) {
  const { contract, customer, provider } = input;
  const item = provider.items.data[0];
  if (
    !item ||
    provider.customer !== customer ||
    (contract.stripeSubscriptionId &&
      contract.stripeSubscriptionId !== provider.id) ||
    item.price.id !== contract.stripePriceId ||
    item.price.unit_amount !== contract.amount ||
    provider.currency.toUpperCase() !== contract.currency ||
    item.price.currency.toUpperCase() !== contract.currency
  )
    throw new AppException(
      'CONFLICT',
      'Provider subscription does not match the contracted offer',
    );
  const paidMembership =
    confirmedTrial(contract, provider, item.current_period_end) ||
    (provider.status === 'active' &&
      provider.latest_invoice?.status === 'paid' &&
      provider.latest_invoice.amount_paid >= contract.amount &&
      item.current_period_end * 1000 > Date.now());
  const endedPaidCancellation =
    (provider.cancel_at_period_end ||
      (contract.cancelAtPeriodEnd && provider.status === 'canceled')) &&
    (provider.status === 'active' || provider.status === 'canceled') &&
    provider.latest_invoice?.status === 'paid' &&
    provider.latest_invoice.amount_paid >= contract.amount &&
    item.current_period_end * 1000 <= Date.now();
  const status: Subscription['status'] =
    paidMembership || endedPaidCancellation
      ? 'confirmed'
      : ['canceled', 'incomplete_expired', 'unpaid', 'past_due'].includes(
            provider.status,
          )
        ? 'unsuccessful'
        : 'pending';
  return {
    stripeSubscriptionId: provider.id,
    providerStatus: provider.status,
    status,
    paidMembership,
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd:
      provider.cancel_at_period_end || Boolean(endedPaidCancellation),
  };
}

function confirmedTrial(
  contract: Contract,
  provider: StripeSubscription,
  periodEnd: number,
) {
  return (
    provider.status === 'trialing' &&
    isAgreedTrial(contract.trialDays ?? 0, provider) &&
    provider.trial_end === periodEnd &&
    periodEnd * 1000 > Date.now()
  );
}
