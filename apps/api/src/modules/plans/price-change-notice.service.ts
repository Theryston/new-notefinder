import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ENV, type Env } from '../../config/env.js';
import { renderPriceChangeEmail } from '../../integrations/email/price-change-email.js';
import { StripeBillingService } from '../../integrations/stripe/stripe-billing.service.js';
import { firstEligibleRenewal } from './price-change-renewal.js';
import { PriceChangesRepository } from './price-changes.repository.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class PriceChangeNoticeService {
  constructor(
    private readonly changes: PriceChangesRepository,
    private readonly subscriptions: SubscriptionsRepository,
    private readonly stripe: StripeBillingService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Transactional()
  async prepareNotice(id: string, userId: string) {
    await this.subscriptions.lock(userId);
    const row = await this.changes.find(id);
    if (
      row?.change.noticeStatus !== 'pending' ||
      (await this.changes.earlier(userId, id))
    )
      return;
    const { contract, price } = row;
    if (
      !contract.stripeSubscriptionId ||
      contract.providerStatus === 'canceled'
    ) {
      await this.changes.update(id, { scheduleStatus: 'cancelled' });
      return;
    }
    if (contract.cancelAtPeriodEnd) return;
    if (contract.priceId === price.id) {
      await this.changes.update(id, { scheduleStatus: 'completed' });
      return;
    }
    if (
      contract.planId !== price.planId ||
      contract.cycle !== price.cycle ||
      contract.currency !== price.currency
    ) {
      await this.changes.update(id, { scheduleStatus: 'cancelled' });
      return;
    }
    if (await this.subscriptions.change(userId)) return;
    if (!price.stripePriceId) {
      await this.changes.update(id, { scheduleStatus: 'failed' });
      return;
    }
    if (!this.env.RESEND_API_KEY) {
      await this.changes.update(id, { noticeStatus: 'failed' });
      return;
    }
    const provider = await this.stripe.getSubscription(
      contract.stripeSubscriptionId,
    );
    if (provider.schedule) {
      await this.changes.update(id, { scheduleStatus: 'failed' });
      return;
    }
    const item = provider.items.data[0];
    if (
      !item ||
      !provider.billing_cycle_anchor ||
      provider.cancel_at_period_end ||
      !['active', 'trialing'].includes(provider.status) ||
      item.price.id !== contract.stripePriceId ||
      item.current_period_end * 1000 !== contract.currentPeriodEnd?.getTime()
    )
      return;
    await this.createNotice(id, row, provider);
  }

  private async createNotice(
    id: string,
    row: NonNullable<Awaited<ReturnType<PriceChangesRepository['find']>>>,
    provider: Awaited<ReturnType<StripeBillingService['getSubscription']>>,
  ) {
    const item = provider.items.data[0];
    if (!item || !provider.billing_cycle_anchor) return;
    const { contract, price } = row;
    const startedAt = new Date();
    const effectiveAt = firstEligibleRenewal({
      noticeAt: startedAt,
      nextRenewal: new Date(item.current_period_end * 1000),
      anchor: new Date(provider.billing_cycle_anchor * 1000),
      cycle: contract.cycle,
    });
    const noticeMessage = renderPriceChangeEmail({
      to: row.recipient.email,
      locale: row.recipient.locale,
      webUrl: this.env.WEB_URL,
      currency: contract.currency,
      oldAmount: contract.amount,
      newAmount: price.amount,
      effectiveAt,
    });
    await this.changes.update(id, {
      oldPriceId: contract.priceId,
      oldAmount: contract.amount,
      noticeStatus: 'sending',
      noticeStartedAt: startedAt,
      reconcileCursor: null,
      nextReconcileAt: null,
      noticeMessage: {
        ...noticeMessage,
        sendBefore: new Date(
          startedAt.getTime() + 23 * 60 * 60 * 1000,
        ).toISOString(),
        tags: [
          { name: 'price_notice', value: `${id}-${row.change.noticeAttempt}` },
        ],
      },
      effectiveAt,
    });
  }

  @Transactional()
  async confirmNotice(
    id: string,
    userId: string,
    sentAt: Date,
    attempt: number,
  ) {
    await this.subscriptions.lock(userId);
    const row = await this.changes.find(id);
    if (
      (row?.change.noticeStatus !== 'sending' &&
        row?.change.noticeStatus !== 'uncertain') ||
      !row.change.effectiveAt ||
      row.change.noticeAttempt !== attempt
    )
      return;
    if (sentAt.getTime() + 30 * DAY > row.change.effectiveAt.getTime()) {
      await this.changes.update(id, {
        noticeHistory: [
          ...row.change.noticeHistory,
          {
            sentAt: sentAt.toISOString(),
            effectiveAt: row.change.effectiveAt.toISOString(),
          },
        ],
        noticeAttempt: row.change.noticeAttempt + 1,
        noticeStatus: 'pending',
        noticeStartedAt: null,
        noticeSentAt: null,
        noticeMessage: null,
        effectiveAt: null,
      });
      return;
    }
    await this.changes.update(id, {
      noticeStatus: 'sent',
      noticeSentAt: sentAt,
    });
  }
}
