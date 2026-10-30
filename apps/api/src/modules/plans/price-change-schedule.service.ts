import { Injectable } from '@nestjs/common';
import { PriceChangesRepository } from './price-changes.repository.js';
import { SubscriptionChangesService } from './subscription-changes.service.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';

@Injectable()
export class PriceChangeScheduleService {
  constructor(
    private readonly changes: PriceChangesRepository,
    private readonly scheduler: SubscriptionChangesService,
    private readonly subscriptions: SubscriptionsRepository,
  ) {}

  async apply(id: string, userId: string) {
    const row = await this.changes.find(id);
    if (row?.change.noticeStatus !== 'sent' || !row.change.effectiveAt) return;
    const { contract, change } = row;
    const effectiveAt = row.change.effectiveAt;
    if (contract.priceId === change.newPriceId) {
      await this.changes.update(id, { scheduleStatus: 'completed' });
      return;
    }
    if (
      contract.providerStatus === 'canceled' ||
      contract.planId !== row.price.planId ||
      contract.cycle !== row.price.cycle ||
      contract.currency !== row.price.currency
    ) {
      await this.changes.update(id, { scheduleStatus: 'cancelled' });
      return;
    }
    if (contract.cancelAtPeriodEnd) return;
    const pending = await this.subscriptions.change(userId);
    if (change.scheduleStatus === 'scheduled' && pending?.change.id === id)
      return;
    if ((contract.currentPeriodEnd?.getTime() ?? 0) < effectiveAt.getTime())
      return;
    if (
      contract.currentPeriodEnd?.getTime() !== effectiveAt.getTime() ||
      effectiveAt.getTime() <= Date.now()
    ) {
      await this.changes.update(id, { scheduleStatus: 'failed' });
      return;
    }
    if (pending && pending.change.id !== id) return;
    try {
      await this.scheduler.reprice(userId, {
        id,
        priceId: change.newPriceId,
        effectiveAt,
      });
      await this.changes.update(id, { scheduleStatus: 'scheduled' });
    } catch (error) {
      await this.changes.update(id, { scheduleStatus: 'failed' });
      throw error;
    }
  }
}
