import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { dailyPracticeStreaks } from '../../database/schema/daily-practice-streaks.js';
import { users } from '../../database/schema/users.js';

@Injectable()
export class StreakReminderRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * PostgreSQL computes the local calendar, including daylight saving time.
   * The explicit order makes sends deterministic: without it, Postgres returns
   * rows in heap order, which an UPDATE to a User changes.
   */
  async findDue(now: Date) {
    const local = sql`(${now.toISOString()}::timestamptz at time zone ${users.timeZone})`;
    return this.txHost.tx
      .select({
        id: users.id,
        email: users.email,
        locale: users.locale,
        day: sql<string>`(${local}::date)::text`,
      })
      .from(users)
      .where(sql`
      ${users.timeZone} is not null
      and extract(hour from ${local}) = 19
      and extract(minute from ${local}) = 0
      and exists (
        select 1 from ${dailyPracticeStreaks} yesterday
        where yesterday.user_id = ${users.id}
          and yesterday.day = ${local}::date - 1
          and yesterday.completed
      )
      and not exists (
        select 1 from ${dailyPracticeStreaks} today
        where today.user_id = ${users.id}
          and today.day = ${local}::date
          and (today.completed or today.reminder_queued_at is not null)
      )
    `)
      .orderBy(users.createdAt, users.id);
  }

  /** Locks the same day as heartbeats, inside the delivery transaction. */
  async reserve(userId: string, day: string, now: Date): Promise<boolean> {
    await this.txHost.tx
      .insert(dailyPracticeStreaks)
      .values({ userId, day })
      .onConflictDoNothing();
    const condition = and(
      eq(dailyPracticeStreaks.userId, userId),
      eq(dailyPracticeStreaks.day, day),
    );
    const [row] = await this.txHost.tx
      .select()
      .from(dailyPracticeStreaks)
      .where(condition)
      .for('update');
    if (row === undefined || row.completed || row.reminderQueuedAt !== null) {
      return false;
    }
    await this.txHost.tx
      .update(dailyPracticeStreaks)
      .set({ reminderQueuedAt: now })
      .where(condition);
    return true;
  }
}
