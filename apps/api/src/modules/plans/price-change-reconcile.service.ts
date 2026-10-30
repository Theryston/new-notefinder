import { Injectable, Logger } from '@nestjs/common';
import { PriceNoticeReconciliation } from '../../integrations/email/price-notice-reconciliation.js';
import { PriceChangeNoticeService } from './price-change-notice.service.js';
import { PriceChangesRepository } from './price-changes.repository.js';

@Injectable()
export class PriceChangeReconcileService {
  private readonly logger = new Logger(PriceChangeReconcileService.name);
  constructor(
    private readonly changes: PriceChangesRepository,
    private readonly provider: PriceNoticeReconciliation,
    private readonly notices: PriceChangeNoticeService,
  ) {}

  async processPending() {
    for (const row of await this.changes.uncertain()) {
      try {
        await this.reconcile(row.id, row.userId);
      } catch (error) {
        await this.changes.saveCursor(
          row.id,
          row.noticeAttempt,
          null,
          new Date(Date.now() + 60 * 60 * 1000),
        );
        this.logger.error(
          `Notice reconciliation ${row.id} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
  }

  async reconcile(id: string, userId: string) {
    const row = await this.changes.find(id);
    const change = row?.change;
    if (
      change?.noticeStatus !== 'uncertain' ||
      !change.noticeMessage ||
      !change.noticeStartedAt
    )
      return;
    const result = await this.provider.find({
      id,
      attempt: change.noticeAttempt,
      cursor: change.reconcileCursor,
      message: change.noticeMessage,
      startedAt: change.noticeStartedAt,
    });
    if (result.found) {
      // Using observation time is conservative: provider creation can precede dispatch.
      await this.notices.confirmNotice(
        id,
        userId,
        new Date(),
        change.noticeAttempt,
      );
    } else
      await this.changes.saveCursor(
        id,
        change.noticeAttempt,
        result.cursor,
        new Date(Date.now() + (result.cursor ? 60_000 : 6 * 60 * 60 * 1000)),
      );
  }
}
