import {
  type CreateSubscriptionChangeBody,
  PLAN_CURRENCIES,
  type PlanCurrency,
} from '@vozzify/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import type { SubscriptionsRepository } from './subscriptions.repository.js';

export function saleOffer(
  input: Awaited<ReturnType<SubscriptionsRepository['offer']>>,
  body: CreateSubscriptionChangeBody,
  currency: PlanCurrency,
  errorMessage = 'The selected offer is no longer available',
) {
  const plan = input.rows[0]?.plan;
  const price = input.rows.find(
    ({ price }) =>
      price.id === body.offerId &&
      price.cycle === body.cycle &&
      price.currency === currency,
  )?.price;
  const complete = plan?.enabledCycles.every((cycle) =>
    PLAN_CURRENCIES.every((required) =>
      input.rows.some(
        ({ price }) =>
          price.cycle === cycle &&
          price.currency === required &&
          price.amount > 0 &&
          price.stripePriceId,
      ),
    ),
  );
  if (
    !input.enabled ||
    !plan ||
    plan.kind !== 'paid' ||
    !plan.published ||
    !plan.saleEnabled ||
    plan.pendingSyncId ||
    !plan.enabledCycles.includes(body.cycle) ||
    !complete ||
    !price?.stripePriceId
  )
    throw new AppException('CONFLICT', errorMessage);
  return { ...price, stripePriceId: price.stripePriceId };
}
