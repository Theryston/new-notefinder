import type { CreateCheckoutBody } from '@vozzify/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { saleOffer } from './sale-offer.js';
import type { SubscriptionsRepository } from './subscriptions.repository.js';

export function checkoutOffer(
  input: Awaited<ReturnType<SubscriptionsRepository['offer']>>,
  body: CreateCheckoutBody,
) {
  const message = 'The selected immediate-billing offer is no longer available';
  if (input.rows[0]?.plan.trialDays !== 0)
    throw new AppException('CONFLICT', message);
  return saleOffer(
    input,
    body,
    body.locale === 'pt-BR' ? 'BRL' : 'USD',
    message,
  );
}
