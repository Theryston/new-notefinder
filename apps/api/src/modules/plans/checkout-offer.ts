import type { CreateCheckoutBody } from '@vozzify/contracts';
import { saleOffer } from './sale-offer.js';
import type { SubscriptionsRepository } from './subscriptions.repository.js';

export function checkoutOffer(
  input: Awaited<ReturnType<SubscriptionsRepository['offer']>>,
  body: CreateCheckoutBody,
) {
  const price = saleOffer(input, body, body.locale === 'pt-BR' ? 'BRL' : 'USD');
  return { ...price, trialDays: input.rows[0]?.plan.trialDays ?? 0 };
}
