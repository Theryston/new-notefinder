import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EmailService } from '../../integrations/email/email.service.js';
import { PriceChangesRepository } from './price-changes.repository.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class PriceChangeRetryService {
  constructor(
    private readonly changes: PriceChangesRepository,
    private readonly subscriptions: SubscriptionsRepository,
    private readonly email: EmailService,
  ) {}

  async retryPlan(planId: string) {
    for (const row of await this.changes.failedForPlan(planId))
      await this.retry(row.id, row.userId);
  }

  @Transactional()
  async retry(id: string, userId: string) {
    await this.subscriptions.lock(userId);
    const row = await this.changes.find(id);
    if (!row) return;
    const { change } = row;
    if (
      change.noticeStatus === 'pending' &&
      change.scheduleStatus === 'failed'
    ) {
      await this.changes.update(id, { scheduleStatus: 'pending' });
      return;
    }
    if (change.noticeStatus === 'sent' && change.scheduleStatus === 'failed') {
      if (
        change.effectiveAt &&
        change.noticeSentAt &&
        change.effectiveAt.getTime() <= Date.now()
      ) {
        await this.restartNotice(id, change);
        return;
      }
      await this.changes.update(id, { scheduleStatus: 'pending' });
      return;
    }
    if (change.noticeStatus !== 'failed') return;
    if (change.noticeSentAt && change.effectiveAt) {
      await this.restartNotice(id, change);
      return;
    }
    if (!change.noticeStartedAt) {
      await this.changes.update(id, { noticeStatus: 'pending' });
      return;
    }
    if (Date.now() - change.noticeStartedAt.getTime() >= DAY) {
      await this.changes.update(id, { noticeStatus: 'uncertain' });
      return;
    }
    await this.email.retryDelivery(
      `price-change-${id}-${change.noticeAttempt}`,
    );
    await this.changes.update(id, { noticeStatus: 'sending' });
  }

  private async restartNotice(
    id: string,
    change: NonNullable<
      Awaited<ReturnType<PriceChangesRepository['find']>>
    >['change'],
  ) {
    if (!change.noticeSentAt || !change.effectiveAt) return;
    await this.changes.update(id, {
      noticeHistory: [
        ...change.noticeHistory,
        {
          sentAt: change.noticeSentAt.toISOString(),
          effectiveAt: change.effectiveAt.toISOString(),
        },
      ],
      noticeAttempt: change.noticeAttempt + 1,
      noticeStatus: 'pending',
      noticeStartedAt: null,
      noticeSentAt: null,
      noticeMessage: null,
      effectiveAt: null,
      scheduleStatus: 'pending',
    });
  }
}
