import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { planPrices } from '../../database/schema/plans.js';
import {
  subscriptionPriceChanges,
  subscriptions,
} from '../../database/schema/subscriptions.js';
import { users } from '../../database/schema/users.js';

@Injectable()
export class PriceChangesRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async pending(after?: string) {
    return this.txHost.tx
      .select({
        id: subscriptionPriceChanges.id,
        userId: subscriptionPriceChanges.userId,
        noticeAttempt: subscriptionPriceChanges.noticeAttempt,
      })
      .from(subscriptionPriceChanges)
      .where(
        and(
          inArray(subscriptionPriceChanges.scheduleStatus, [
            'pending',
            'failed',
            'scheduled',
          ]),
          after ? gt(subscriptionPriceChanges.id, after) : undefined,
        ),
      )
      .orderBy(asc(subscriptionPriceChanges.id))
      .limit(100);
  }

  async find(id: string) {
    const rows = await this.txHost.tx
      .select({
        change: subscriptionPriceChanges,
        contract: subscriptions,
        price: planPrices,
        recipient: { email: users.email, locale: users.locale },
      })
      .from(subscriptionPriceChanges)
      .innerJoin(
        subscriptions,
        eq(subscriptions.id, subscriptionPriceChanges.subscriptionId),
      )
      .innerJoin(
        planPrices,
        eq(planPrices.id, subscriptionPriceChanges.newPriceId),
      )
      .innerJoin(users, eq(users.id, subscriptionPriceChanges.userId))
      .where(eq(subscriptionPriceChanges.id, id));
    return rows[0];
  }

  async failedForPlan(planId: string) {
    return this.txHost.tx
      .select({
        id: subscriptionPriceChanges.id,
        userId: subscriptionPriceChanges.userId,
      })
      .from(subscriptionPriceChanges)
      .innerJoin(
        subscriptions,
        eq(subscriptions.id, subscriptionPriceChanges.subscriptionId),
      )
      .where(
        and(
          eq(subscriptions.planId, planId),
          inArray(subscriptionPriceChanges.scheduleStatus, [
            'pending',
            'failed',
          ]),
          or(
            inArray(subscriptionPriceChanges.noticeStatus, [
              'failed',
              'rejected',
            ]),
            eq(subscriptionPriceChanges.scheduleStatus, 'failed'),
          ),
        ),
      );
  }

  async uncertain() {
    return this.txHost.tx
      .select({
        id: subscriptionPriceChanges.id,
        userId: subscriptionPriceChanges.userId,
        noticeAttempt: subscriptionPriceChanges.noticeAttempt,
      })
      .from(subscriptionPriceChanges)
      .where(
        and(
          eq(subscriptionPriceChanges.noticeStatus, 'uncertain'),
          inArray(subscriptionPriceChanges.scheduleStatus, [
            'pending',
            'failed',
          ]),
          or(
            isNull(subscriptionPriceChanges.nextReconcileAt),
            lte(subscriptionPriceChanges.nextReconcileAt, new Date()),
          ),
        ),
      )
      .orderBy(asc(subscriptionPriceChanges.updatedAt))
      .limit(100);
  }

  async saveCursor(
    id: string,
    attempt: number,
    cursor: string | null,
    retryAt: Date,
  ) {
    await this.txHost.tx
      .update(subscriptionPriceChanges)
      .set({ reconcileCursor: cursor, nextReconcileAt: retryAt })
      .where(
        and(
          eq(subscriptionPriceChanges.id, id),
          eq(subscriptionPriceChanges.noticeAttempt, attempt),
          eq(subscriptionPriceChanges.noticeStatus, 'uncertain'),
        ),
      );
  }

  async earlier(userId: string, id: string) {
    const rows = await this.txHost.tx
      .select({ id: subscriptionPriceChanges.id })
      .from(subscriptionPriceChanges)
      .where(
        and(
          eq(subscriptionPriceChanges.userId, userId),
          inArray(subscriptionPriceChanges.scheduleStatus, [
            'pending',
            'failed',
            'scheduled',
          ]),
        ),
      )
      .orderBy(asc(subscriptionPriceChanges.sequence))
      .limit(1);
    return rows[0]?.id !== id;
  }

  async update(
    id: string,
    fields: Partial<typeof subscriptionPriceChanges.$inferInsert>,
  ) {
    await this.txHost.tx
      .update(subscriptionPriceChanges)
      .set(fields)
      .where(eq(subscriptionPriceChanges.id, id));
  }
  async markNoticeFailure(id: string, attempt: number) {
    await this.txHost.tx
      .update(subscriptionPriceChanges)
      .set({ noticeStatus: 'failed' })
      .where(
        and(
          eq(subscriptionPriceChanges.id, id),
          eq(subscriptionPriceChanges.noticeAttempt, attempt),
          inArray(subscriptionPriceChanges.noticeStatus, [
            'pending',
            'sending',
          ]),
          inArray(subscriptionPriceChanges.scheduleStatus, [
            'pending',
            'failed',
          ]),
        ),
      );
  }
  async transitionNotice(
    id: string,
    attempt: number,
    expected: 'sending' | 'failed',
    status: 'failed' | 'uncertain' | 'rejected',
  ) {
    await this.txHost.tx
      .update(subscriptionPriceChanges)
      .set({ noticeStatus: status })
      .where(
        and(
          eq(subscriptionPriceChanges.id, id),
          eq(subscriptionPriceChanges.noticeAttempt, attempt),
          eq(subscriptionPriceChanges.noticeStatus, expected),
        ),
      );
  }
}
