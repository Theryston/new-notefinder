import type { StripeSubscription } from '../../integrations/stripe/stripe-billing.service.js';

export function isAgreedTrial(
  days: number,
  provider: Pick<
    StripeSubscription,
    'trial_start' | 'trial_end' | 'default_payment_method'
  >,
) {
  return (
    days > 0 &&
    Boolean(provider.default_payment_method) &&
    provider.trial_start != null &&
    provider.trial_end != null &&
    provider.trial_end - provider.trial_start === days * 86400
  );
}
