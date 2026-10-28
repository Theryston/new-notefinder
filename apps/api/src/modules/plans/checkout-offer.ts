import {
  type CreateCheckoutBody,
  PLAN_CURRENCIES,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import type { SubscriptionsRepository } from './subscriptions.repository.js';

export function checkoutOffer(
  input: Awaited<ReturnType<SubscriptionsRepository['offer']>>,
  body: CreateCheckoutBody,
) {
  const plan = input.rows[0]?.plan;
  const currency = body.locale === 'pt-BR' ? 'BRL' : 'USD';
  const price = input.rows.find(
    (row) =>
      row.price.id === body.offerId &&
      row.price.cycle === body.cycle &&
      row.price.currency === currency,
  )?.price;
  const complete = plan?.enabledCycles.every((cycle) =>
    PLAN_CURRENCIES.every((required) =>
      input.rows.some(
        (row) =>
          row.price.cycle === cycle &&
          row.price.currency === required &&
          row.price.amount > 0 &&
          row.price.stripePriceId,
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
    !price?.stripePriceId ||
    plan.trialDays !== 0
  )
    throw new AppException(
      'CONFLICT',
      'The selected immediate-billing offer is no longer available',
    );
  return { ...price, stripePriceId: price.stripePriceId };
}
