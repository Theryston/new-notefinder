import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { createId } from '@paralleldrive/cuid2';
import type { CreateSubscriptionChangeBody, Locale } from '@vozzify/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { StripeBillingService } from '../../integrations/stripe/stripe-billing.service.js';
import { saleOffer } from './sale-offer.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';

@Injectable()
export class SubscriptionChangesService {
  constructor(
    private readonly repository: SubscriptionsRepository,
    private readonly stripe: StripeBillingService,
  ) {}
  async change(userId: string, body: CreateSubscriptionChangeBody) {
    await this.reserveChange(userId, body);
    await this.prepareSchedule(userId);
    await this.scheduleChange(userId);
  }

  async reprice(
    userId: string,
    input: { id: string; priceId: string; effectiveAt: Date },
  ) {
    await this.reserveReprice(userId, input);
    await this.prepareSchedule(userId);
    await this.scheduleChange(userId);
  }

  @Transactional()
  async reserveReprice(
    userId: string,
    input: { id: string; priceId: string; effectiveAt: Date },
  ) {
    await this.repository.lock(userId);
    const row = await this.repository.current(userId);
    const price = await this.repository.price(input.priceId);
    const pending = await this.repository.change(userId);
    const contract = row?.contract;
    if (
      pending?.change.id === input.id &&
      pending.change.priceId === input.priceId &&
      pending.change.effectiveAt.getTime() === input.effectiveAt.getTime()
    )
      return;
    if (
      pending ||
      !contract?.stripeSubscriptionId ||
      !contract.currentPeriodEnd ||
      !contract.currentPeriodStart ||
      contract.cancelAtPeriodEnd ||
      !price?.stripePriceId ||
      contract.planId !== price.planId ||
      contract.cycle !== price.cycle ||
      contract.currency !== price.currency ||
      contract.currentPeriodEnd.getTime() !== input.effectiveAt.getTime() ||
      contract.currentPeriodEnd.getTime() <= Date.now()
    )
      throw new AppException(
        'CONFLICT',
        'Subscription repricing is unavailable',
      );
    await this.repository.saveChange({
      id: input.id,
      userId,
      subscriptionId: contract.id,
      planId: price.planId,
      priceId: price.id,
      cycle: price.cycle,
      currency: price.currency,
      amount: price.amount,
      stripePriceId: price.stripePriceId,
      effectiveAt: contract.currentPeriodEnd,
      stripeScheduleId: null,
      applied: false,
      agreed: null,
    });
  }

  @Transactional()
  async reserveChange(userId: string, body: CreateSubscriptionChangeBody) {
    await this.repository.lock(userId);
    await this.reconcilePending(userId);
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
  async reconcilePending(userId: string) {
    await this.repository.lock(userId);
    const pending = await this.repository.change(userId);
    if (!pending || pending.change.applied) return;
    const input = await this.scheduleInput(userId);
    if (!input) return;
    if ((await this.stripe.inspectSchedule(input)) === 'pending') {
      await this.repository.updateChange(userId, { applied: true });
      await this.repository.cancelReprices(userId, pending.change.id);
    }
  }

  @Transactional()
  async prepareSchedule(userId: string) {
    await this.repository.lock(userId);
    const input = await this.scheduleInput(userId);
    if (!input) return;
    const scheduleId = await this.stripe.prepareSchedule(input);
    await this.repository.updateChange(userId, {
      stripeScheduleId: scheduleId,
    });
  }

  @Transactional()
  async scheduleChange(userId: string) {
    await this.repository.lock(userId);
    const input = await this.scheduleInput(userId);
    if (!input) return;
    await this.stripe.scheduleChange(input);
    await this.repository.updateChange(userId, { applied: true });
    await this.repository.cancelReprices(userId, input.id);
  }

  private async scheduleInput(userId: string) {
    const row = await this.repository.current(userId);
    const pending = await this.repository.change(userId);
    if (!row?.contract.stripeSubscriptionId || !pending)
      throw new AppException('CONFLICT', 'Subscription change is unavailable');
    if (pending.change.applied) return null;
    const contract = row.contract;
    const subscription = contract.stripeSubscriptionId;
    if (!subscription)
      throw new AppException('CONFLICT', 'Subscription is unavailable');
    return {
      id: pending.change.id,
      subscription,
      schedule: pending.change.stripeScheduleId,
      currentPrice: contract.stripePriceId,
      currentCycle: contract.cycle,
      nextPrice: pending.change.stripePriceId,
      nextCycle: pending.change.cycle,
      previousPrice: pending.change.agreed?.stripePriceId ?? null,
      previousCycle: pending.change.agreed?.cycle ?? null,
      start: Math.floor((contract.currentPeriodStart?.getTime() ?? 0) / 1000),
      end: Math.floor(pending.change.effectiveAt.getTime() / 1000),
    };
  }
  @Transactional()
  async visible(userId: string, locale: Locale) {
    await this.repository.lock(userId);
    await this.reconcilePending(userId);
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
}
