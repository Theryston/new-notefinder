import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type {
  CheckoutResult,
  CreateCheckoutBody,
  CurrentSubscription,
  Locale,
} from '@notefinder/contracts';
import { createId } from '@paralleldrive/cuid2';
import { AppException } from '../../common/errors/app-exception.js';
import { StripeBillingService } from '../../integrations/stripe/stripe-billing.service.js';
import { checkoutOffer } from './checkout-offer.js';
import { confirmedSubscription } from './subscription-state.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly repository: SubscriptionsRepository,
    private readonly stripe: StripeBillingService,
  ) {}

  async checkout(
    userId: string,
    body: CreateCheckoutBody,
  ): Promise<CheckoutResult> {
    await this.reserve(userId, body);
    await this.ensureCustomer(userId);
    await this.reconcile(userId, body);
    return this.start(userId, body);
  }

  // Commit the attempt identity before calling Stripe: failures reuse the same key.
  @Transactional()
  async reserve(userId: string, body: CreateCheckoutBody) {
    await this.repository.lock(userId);
    const existing = await this.repository.current(userId);
    if (existing) {
      if (
        !existing.contract.checkoutId ||
        existing.contract.stripeSubscriptionId
      )
        return;
      const session = await this.stripe.getCheckout(
        existing.contract.checkoutId,
      );
      if (session.status !== 'expired' || session.subscription) return;
    }
    const price = checkoutOffer(await this.repository.offer(body), body);
    const reservation = {
      id: createId(),
      userId,
      planId: body.planId,
      priceId: price.id,
      cycle: price.cycle,
      currency: price.currency,
      amount: price.amount,
      stripePriceId: price.stripePriceId,
      checkoutId: null,
      checkoutUrl: null,
      createdAt: new Date(),
      status: 'pending' as const,
    };
    if (existing) await this.repository.update(userId, reservation);
    else await this.repository.create(reservation);
  }

  @Transactional()
  async ensureCustomer(userId: string) {
    await this.repository.lock(userId);
    if ((await this.repository.customer(userId))?.stripeCustomerId) return;
    await this.repository.saveCustomer(
      userId,
      await this.stripe.createCustomer(userId),
    );
  }

  // A lost Stripe response is reconciled before changing or retrying an attempt.
  // Persist the recovered session or replacement key before any session creation.
  @Transactional()
  async reconcile(userId: string, body: CreateCheckoutBody) {
    await this.repository.lock(userId);
    const row = await this.repository.current(userId);
    if (!row || row.contract.checkoutId || row.contract.stripeSubscriptionId)
      return;
    const customer = await this.repository.customer(userId);
    if (!customer?.stripeCustomerId)
      throw new AppException('CONFLICT', 'Billing customer is missing');
    const session = await this.stripe.findCheckout(
      customer.stripeCustomerId,
      row.contract.id,
    );
    if (session) {
      await this.repository.update(userId, {
        checkoutId: session.id,
        checkoutUrl: session.url,
      });
      return;
    }
    const price = checkoutOffer(await this.repository.offer(body), body);
    if (
      row.contract.priceId === price.id &&
      Date.now() - row.contract.createdAt.getTime() < 23 * 60 * 60 * 1000
    )
      return;
    await this.repository.update(userId, {
      id: createId(),
      planId: body.planId,
      priceId: price.id,
      cycle: price.cycle,
      currency: price.currency,
      amount: price.amount,
      stripePriceId: price.stripePriceId,
      createdAt: new Date(),
    });
  }

  @Transactional()
  async start(
    userId: string,
    body: CreateCheckoutBody,
  ): Promise<CheckoutResult> {
    await this.repository.lock(userId);
    const row = await this.repository.current(userId);
    if (!row)
      throw new AppException('CONFLICT', 'Checkout reservation is missing');
    const contract = row.contract;
    if (contract.stripeSubscriptionId) return { action: 'manage' };
    if (
      contract.priceId !== body.offerId ||
      contract.planId !== body.planId ||
      contract.cycle !== body.cycle
    )
      return { action: 'manage' };
    if (contract.checkoutId) {
      const session = await this.stripe.getCheckout(contract.checkoutId);
      if (session.status === 'complete') return { action: 'manage' };
      if (session.status === 'open' && session.url)
        return { action: 'checkout', url: session.url };
      throw new AppException(
        'CONFLICT',
        'Checkout expired; retry the selected offer',
      );
    }
    checkoutOffer(await this.repository.offer(body), body);
    const customer = (await this.repository.customer(userId))?.stripeCustomerId;
    if (!customer)
      throw new AppException('CONFLICT', 'Billing customer is missing');
    const session = await this.stripe.createCheckout({
      id: contract.id,
      customer,
      price: contract.stripePriceId,
      locale: body.locale,
    });
    if (!session.url || session.customer !== customer)
      throw new AppException(
        'SERVICE_UNAVAILABLE',
        'Stripe checkout is unavailable',
      );
    await this.repository.update(userId, {
      checkoutId: session.id,
      checkoutUrl: session.url,
    });
    return { action: 'checkout', url: session.url };
  }

  async summary(userId: string, locale: Locale): Promise<CurrentSubscription> {
    const row = await this.repository.current(userId);
    if (!row) return { subscription: null };
    const contract = row.contract;
    return {
      subscription: {
        planId: contract.planId,
        planName: row.copy[locale].name,
        cycle: contract.cycle,
        currency: contract.currency,
        amount: contract.amount,
        status: contract.status,
        providerStatus: contract.providerStatus,
        paidMembership:
          contract.paidMembership &&
          (contract.currentPeriodEnd?.getTime() ?? 0) > Date.now(),
        currentPeriodStart: contract.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: contract.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: contract.cancelAtPeriodEnd,
      },
    };
  }

  @Transactional()
  async webhook(event: {
    id: string;
    type: string;
    data: { object: { customer?: string } };
  }) {
    const customer = event.data.object.customer;
    if (!customer) return;
    const userId = await this.repository.userForCustomer(customer);
    if (!userId) return;
    await this.repository.lock(userId);
    if (await this.repository.processed(event.id)) return;
    await this.refresh(userId, customer);
    await this.repository.markProcessed(event.id);
  }

  private async refresh(userId: string, customer: string) {
    const row = await this.repository.current(userId);
    if (!row) return;
    const session = row.contract.checkoutId
      ? await this.stripe.getCheckout(row.contract.checkoutId)
      : await this.stripe.findCheckout(customer, row.contract.id);
    if (!session) return;
    if (!row.contract.checkoutId)
      await this.repository.update(userId, {
        checkoutId: session.id,
        checkoutUrl: session.url,
      });
    if (session.customer !== customer)
      throw new AppException('CONFLICT', 'Checkout customer mismatch');
    if (session.subscription) {
      const provider = await this.stripe.getSubscription(session.subscription);
      await this.repository.update(
        userId,
        confirmedSubscription({ contract: row.contract, provider, customer }),
      );
    } else if (session.status === 'expired') {
      await this.repository.update(userId, {
        status: 'unsuccessful',
        paidMembership: false,
      });
    }
  }
}
