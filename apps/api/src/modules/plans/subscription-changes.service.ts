import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { createId } from '@paralleldrive/cuid2';
import type { CreateSubscriptionChangeBody, Locale } from '@vozzify/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { StripeBillingService } from '../../integrations/stripe/stripe-billing.service.js';
import { saleOffer } from './sale-offer.js';
import { confirmedSubscription } from './subscription-state.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';

@Injectable()
export class SubscriptionChangesService {
  constructor(
    private readonly repository: SubscriptionsRepository,
    private readonly stripe: StripeBillingService,
  ) {}
  async change(userId: string, body: CreateSubscriptionChangeBody) {
    await this.reserveChange(userId, body);
    await this.scheduleChange(userId);
  }

  @Transactional()
  async reserveChange(userId: string, body: CreateSubscriptionChangeBody) {
    await this.repository.lock(userId);
    const row = await this.repository.current(userId);
    const contract = row?.contract;
    if (
      !contract?.stripeSubscriptionId ||
      !contract.paidMembership ||
      !contract.currentPeriodEnd ||
      !contract.currentPeriodStart ||
      contract.cancelAtPeriodEnd ||
      contract.currentPeriodEnd.getTime() <= Date.now()
    )
      throw new AppException('CONFLICT', 'Subscription cannot be changed');
    const price = saleOffer(
      await this.repository.offer(body),
      body,
      contract.currency,
    );
    const previous = await this.repository.change(userId);
    if (
      previous?.change.priceId === price.id &&
      previous.change.effectiveAt.getTime() ===
        contract.currentPeriodEnd.getTime()
    )
      return;
    await this.repository.saveChange({
      id: createId(),
      userId,
      subscriptionId: contract.id,
      planId: body.planId,
      priceId: price.id,
      cycle: price.cycle,
      currency: price.currency,
      amount: price.amount,
      stripePriceId: price.stripePriceId,
      effectiveAt: contract.currentPeriodEnd,
      stripeScheduleId: previous?.change.stripeScheduleId ?? null,
      applied: false,
      agreed: previous?.change.applied
        ? {
            planId: previous.change.planId,
            priceId: previous.change.priceId,
            cycle: previous.change.cycle,
            currency: previous.change.currency,
            amount: previous.change.amount,
            stripePriceId: previous.change.stripePriceId,
            effectiveAt: previous.change.effectiveAt.toISOString(),
          }
        : (previous?.change.agreed ?? null),
    });
  }

  @Transactional()
  async scheduleChange(userId: string) {
    await this.repository.lock(userId);
    const row = await this.repository.current(userId);
    const pending = await this.repository.change(userId);
    if (!row?.contract.stripeSubscriptionId || !pending)
      throw new AppException('CONFLICT', 'Subscription change is unavailable');
    if (pending.change.applied) return;
    const contract = row.contract;
    const subscription = contract.stripeSubscriptionId;
    if (!subscription)
      throw new AppException('CONFLICT', 'Subscription is unavailable');
    const scheduleId = await this.stripe.scheduleChange({
      id: pending.change.id,
      subscription,
      schedule: pending.change.stripeScheduleId,
      currentPrice: contract.stripePriceId,
      nextPrice: pending.change.stripePriceId,
      nextCycle: pending.change.cycle,
      previousPrice: pending.change.agreed?.stripePriceId ?? null,
      previousCycle: pending.change.agreed?.cycle ?? null,
      start: Math.floor((contract.currentPeriodStart?.getTime() ?? 0) / 1000),
      end: Math.floor(pending.change.effectiveAt.getTime() / 1000),
    });
    await this.repository.updateChange(userId, {
      stripeScheduleId: scheduleId,
      applied: true,
    });
  }
  async visible(userId: string, locale: Locale) {
    const row = await this.repository.change(userId);
    if (!row) return null;
    const change = row.change.applied
      ? { ...row.change, effectiveAt: row.change.effectiveAt.toISOString() }
      : row.change.agreed;
    if (!change) return null;
    const copy =
      change.planId === row.change.planId
        ? row.copy
        : await this.repository.planCopy(change.planId);
    if (!copy) throw new AppException('CONFLICT', 'Scheduled plan is missing');
    return {
      planId: change.planId,
      planName: copy[locale].name,
      cycle: change.cycle,
      currency: change.currency,
      amount: change.amount,
      effectiveAt: change.effectiveAt,
    };
  }

  async refreshProvider(input: {
    userId: string;
    customer: string;
    contract: NonNullable<
      Awaited<ReturnType<SubscriptionsRepository['current']>>
    >['contract'];
    subscription: string;
  }) {
    const provider = await this.stripe.getSubscription(input.subscription);
    const pending = await this.repository.change(input.userId);
    const item = provider.items.data[0];
    const current = pending
      ? {
          ...pending.change,
          effectiveAt: pending.change.effectiveAt.toISOString(),
        }
      : null;
    const candidates = [current, pending?.change.agreed].filter(
      (value) => value != null,
    );
    const activated =
      item &&
      candidates.find(
        (change) =>
          item.price.id === change.stripePriceId &&
          item.current_period_start * 1000 >=
            new Date(change.effectiveAt).getTime(),
      );
    const projection = confirmedSubscription({
      contract: activated
        ? { ...input.contract, ...activated }
        : input.contract,
      provider,
      customer: input.customer,
    });
    await this.repository.update(
      input.userId,
      activated
        ? {
            ...projection,
            planId: activated.planId,
            priceId: activated.priceId,
            cycle: activated.cycle,
            currency: activated.currency,
            amount: activated.amount,
            stripePriceId: activated.stripePriceId,
          }
        : projection,
    );
    if (
      pending &&
      (activated ||
        provider.cancel_at_period_end ||
        provider.status === 'canceled')
    )
      await this.repository.deleteChange(input.userId);
  }
}
