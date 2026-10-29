import { AppException } from '../../common/errors/app-exception.js';
import type { StripeBillingService } from '../../integrations/stripe/stripe-billing.service.js';
import { confirmedSubscription } from './subscription-state.js';
import type { SubscriptionsRepository } from './subscriptions.repository.js';
import { isAgreedTrial } from './trial-terms.js';

export async function replaceEndedContract(input: {
  userId: string;
  repository: SubscriptionsRepository;
  stripe: StripeBillingService;
  reservation: () => Promise<Parameters<SubscriptionsRepository['create']>[0]>;
}) {
  const { userId, repository, stripe } = input;
  await repository.lock(userId);
  const row = await repository.current(userId);
  if (
    !row?.contract.stripeSubscriptionId ||
    row.contract.providerStatus !== 'canceled' ||
    (row.contract.currentPeriodEnd?.getTime() ?? Infinity) > Date.now()
  )
    return;
  const customer = (await repository.customer(userId))?.stripeCustomerId;
  if (!customer)
    throw new AppException('CONFLICT', 'Billing customer is missing');
  const provider = await stripe.getSubscription(
    row.contract.stripeSubscriptionId,
  );
  if (provider.status !== 'canceled') return;
  const projection = confirmedSubscription({
    contract: row.contract,
    provider,
    customer,
  });
  if (projection.currentPeriodEnd.getTime() > Date.now()) return;
  if (isAgreedTrial(row.contract.trialDays, provider))
    await repository.markTrialUsed(userId);
  const replacement = await input.reservation();
  await repository.archive(row.contract);
  await repository.remove(userId);
  await repository.create(replacement);
}
