import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../integrations/email/email.service.js';
import { PriceChangeNoticeService } from './price-change-notice.service.js';
import { PriceChangeScheduleService } from './price-change-schedule.service.js';
import { PriceChangesRepository } from './price-changes.repository.js';

const DAY = 24 * 60 * 60 * 1000;
const RETENTION_SECONDS = (31 * DAY) / 1000;

@Injectable()
export class PriceChangesService {
  private readonly logger = new Logger(PriceChangesService.name);
  constructor(
    private readonly changes: PriceChangesRepository,
    private readonly email: EmailService,
    private readonly notices: PriceChangeNoticeService,
    private readonly schedule: PriceChangeScheduleService,
  ) {}

  async processPending() {
    let cursor: string | undefined;
    while (true) {
      const page = await this.changes.pending(cursor);
      for (const row of page) await this.processSafely(row);
      if (page.length < 100) return;
      cursor = page.at(-1)?.id;
      if (!cursor) return;
    }
  }

  private async processSafely(row: {
    id: string;
    userId: string;
    noticeAttempt: number;
  }) {
    try {
      await this.process(row.id, row.userId);
    } catch (error) {
      await this.changes.markNoticeFailure(row.id, row.noticeAttempt);
      this.logger.error(
        `Price change ${row.id} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async process(id: string, userId: string) {
    await this.notices.prepareNotice(id, userId);
    const row = await this.changes.find(id);
    if (
      row?.change.noticeStatus === 'failed' &&
      row.change.noticeStartedAt &&
      Date.now() - row.change.noticeStartedAt.getTime() >= DAY
    ) {
      await this.changes.transitionNotice(
        id,
        row.change.noticeAttempt,
        'failed',
        'uncertain',
      );
      return;
    }
    if (row?.change.noticeStatus !== 'sending') {
      await this.schedule.apply(id, userId);
      return;
    }
    const jobId = `price-change-${id}-${row.change.noticeAttempt}`;
    const delivery = await this.email.delivery(jobId);
    if (delivery.state === 'sent') {
      await this.notices.confirmNotice(
        id,
        userId,
        delivery.sentAt,
        row.change.noticeAttempt,
      );
      await this.schedule.apply(id, userId);
    } else if (delivery.state === 'rejected' || delivery.state === 'failed') {
      await this.recordFailure(id, row.change, delivery.state);
    } else if (
      delivery.state === 'missing' &&
      row.change.noticeMessage &&
      row.change.noticeStartedAt
    ) {
      if (Date.now() - row.change.noticeStartedAt.getTime() >= DAY) {
        await this.changes.transitionNotice(
          id,
          row.change.noticeAttempt,
          'sending',
          'uncertain',
        );
      } else {
        await this.email.send(row.change.noticeMessage, {
          jobId,
          retainForSeconds: RETENTION_SECONDS,
        });
      }
    }
  }
  private async recordFailure(
    id: string,
    change: NonNullable<
      Awaited<ReturnType<PriceChangesRepository['find']>>
    >['change'],
    state: 'rejected' | 'failed',
  ) {
    const status =
      state === 'rejected'
        ? 'rejected'
        : change.noticeStartedAt &&
            Date.now() - change.noticeStartedAt.getTime() >= DAY
          ? 'uncertain'
          : 'failed';
    await this.changes.transitionNotice(
      id,
      change.noticeAttempt,
      'sending',
      status,
    );
  }
}
