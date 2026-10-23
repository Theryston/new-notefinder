import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { dailyPracticeStreaks } from '../../database/schema/daily-practice-streaks.js';
import { practiceHeartbeats } from '../../database/schema/practice-heartbeats.js';

/** One practice day of a User. */
export type PracticeDayRow = {
  id: string;
  day: string;
  listenedSeconds: number;
  completed: boolean;
  lastHeartbeatAt: Date | null;
};

const practiceDayColumns = {
  id: dailyPracticeStreaks.id,
  day: dailyPracticeStreaks.day,
  listenedSeconds: dailyPracticeStreaks.listenedSeconds,
  completed: dailyPracticeStreaks.completed,
  lastHeartbeatAt: dailyPracticeStreaks.lastHeartbeatAt,
};

const ofDay = (userId: string, day: string) =>
  and(
    eq(dailyPracticeStreaks.userId, userId),
    eq(dailyPracticeStreaks.day, day),
  );

@Injectable()
export class StreaksRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** Stores only heartbeats explicitly tied to a Track page view. */
  async recordAttributedHeartbeat(values: {
    userId: string;
    viewId: string;
    elapsedSeconds: number;
    creditedSeconds: number;
  }): Promise<void> {
    await this.txHost.tx.insert(practiceHeartbeats).values(values);
  }

  async findDay(
    userId: string,
    day: string,
  ): Promise<PracticeDayRow | undefined> {
    const [row] = await this.txHost.tx
      .select(practiceDayColumns)
      .from(dailyPracticeStreaks)
      .where(ofDay(userId, day))
      .limit(1);
    return row;
  }

  /**
   * The row of the User's day, created empty when it is the first heartbeat of
   * the day, and locked until the transaction ends so two heartbeats of one
   * User credit one after the other.
   */
  async lockDay(userId: string, day: string): Promise<PracticeDayRow> {
    await this.txHost.tx
      .insert(dailyPracticeStreaks)
      .values({ userId, day })
      .onConflictDoNothing({
        target: [dailyPracticeStreaks.userId, dailyPracticeStreaks.day],
      });
    const [row] = await this.txHost.tx
      .select(practiceDayColumns)
      .from(dailyPracticeStreaks)
      .where(ofDay(userId, day))
      .for('update');
    if (row === undefined) {
      throw new Error('The practice day row is missing after its insert');
    }
    return row;
  }

  /** Saves the heartbeat: the new total, its time and, if it reached the target, the completion. */
  async saveHeartbeat(
    id: string,
    values: {
      listenedSeconds: number;
      heartbeatAt: Date;
      completesDay: boolean;
    },
  ): Promise<void> {
    await this.txHost.tx
      .update(dailyPracticeStreaks)
      .set({
        listenedSeconds: values.listenedSeconds,
        lastHeartbeatAt: values.heartbeatAt,
        ...(values.completesDay
          ? { completed: true, completedAt: values.heartbeatAt }
          : {}),
      })
      .where(eq(dailyPracticeStreaks.id, id));
  }

  /** Every day the User completed, as `YYYY-MM-DD`. */
  async findCompletedDays(userId: string): Promise<string[]> {
    const rows = await this.txHost.tx
      .select({ day: dailyPracticeStreaks.day })
      .from(dailyPracticeStreaks)
      .where(
        and(
          eq(dailyPracticeStreaks.userId, userId),
          eq(dailyPracticeStreaks.completed, true),
        ),
      );
    return rows.map((row) => row.day);
  }
}
