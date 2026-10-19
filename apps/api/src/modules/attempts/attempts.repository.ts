import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  practiceAttempts,
  type practiceDifficulty,
} from '../../database/schema/practice-attempts.js';
import { tracks } from '../../database/schema/tracks.js';
import type { OwnAttemptCursor } from './own-attempt-cursor.js';

type Difficulty = (typeof practiceDifficulty.enumValues)[number];

/** A saved practice run, as the database keeps it. */
export type PracticeAttemptRow = typeof practiceAttempts.$inferSelect;

/** A saved run with the header of the Track it was sung on. */
export type PracticeAttemptHistoryRow = {
  attempt: PracticeAttemptRow;
  track: Pick<
    typeof tracks.$inferSelect,
    'id' | 'title' | 'coverUrl' | 'artistCredit'
  >;
};

/** The fields of a run the page scored, with its owner and Track. */
export type NewPracticeAttempt = {
  userId: string;
  trackId: string;
  difficulty: Difficulty;
  octaveMode: 'ANY' | 'EXACT';
  transposeSemitones: number;
  speed: number;
  accuracy: number;
  coverage: number;
  forwardSkip: boolean;
  bleedSuspected: boolean;
  startedAt: Date;
  endedAt: Date;
};

@Injectable()
export class AttemptsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** Saves a run the service already judged valid. */
  async insert(attempt: NewPracticeAttempt): Promise<PracticeAttemptRow> {
    const [row] = await this.txHost.tx
      .insert(practiceAttempts)
      .values(attempt)
      .returning();
    if (!row) {
      throw new Error('Saving the practice attempt returned no row');
    }
    return row;
  }

  /** The best accuracy per difficulty of a User on a Track, if any. */
  async bestAccuracies(
    userId: string,
    trackId: string,
  ): Promise<{ difficulty: Difficulty; accuracy: number }[]> {
    return this.txHost.tx
      .select({
        difficulty: practiceAttempts.difficulty,
        accuracy: sql<number>`max(${practiceAttempts.accuracy})`,
      })
      .from(practiceAttempts)
      .where(
        and(
          eq(practiceAttempts.userId, userId),
          eq(practiceAttempts.trackId, trackId),
        ),
      )
      .groupBy(practiceAttempts.difficulty);
  }

  /** Up to `limit` attempts of the User after the cursor, newest first. */
  listOwn(options: {
    userId: string;
    after: OwnAttemptCursor | undefined;
    limit: number;
  }): Promise<PracticeAttemptRow[]> {
    const { userId, after, limit } = options;
    return this.txHost.tx
      .select()
      .from(practiceAttempts)
      .where(ownedAfter(userId, after))
      .orderBy(...NEWEST_FIRST)
      .limit(limit);
  }

  /**
   * Up to `limit` attempts of the User after the cursor, newest first, each
   * with the header of the Track it was sung on. The Track is joined in the
   * same query so a page costs one round trip; artists.repository reads the
   * tracks table the same way. The join is inner: a run always has its Track
   * (the foreign key cascades).
   */
  listHistory(options: {
    userId: string;
    after: OwnAttemptCursor | undefined;
    limit: number;
  }): Promise<PracticeAttemptHistoryRow[]> {
    const { userId, after, limit } = options;
    return this.txHost.tx
      .select({
        attempt: practiceAttempts,
        track: {
          id: tracks.id,
          title: tracks.title,
          coverUrl: tracks.coverUrl,
          artistCredit: tracks.artistCredit,
        },
      })
      .from(practiceAttempts)
      .innerJoin(tracks, eq(practiceAttempts.trackId, tracks.id))
      .where(historyAfter(userId, after))
      .orderBy(...HISTORY_NEWEST_FIRST)
      .limit(limit);
  }
}

/**
 * The save time cut to the millisecond, which is what a cursor carries. The
 * column keeps microseconds, so comparing the raw column would skip or repeat
 * runs saved in the same millisecond: the cursor cannot tell them apart.
 */
const savedAtMs = sql<Date>`date_trunc('milliseconds', ${practiceAttempts.createdAt})`;

/** Newest first by the millisecond; the ID breaks ties within one. */
const HISTORY_NEWEST_FIRST = [
  desc(savedAtMs),
  desc(practiceAttempts.id),
] as const;

/** The User's runs strictly after the cursor in the history order. */
const historyAfter = (userId: string, after: OwnAttemptCursor | undefined) => {
  const owned = eq(practiceAttempts.userId, userId);
  if (!after) {
    return owned;
  }
  const createdAt = new Date(after.createdAt);
  return and(
    owned,
    or(
      lt(savedAtMs, createdAt),
      and(
        sql`${savedAtMs} = ${createdAt}`,
        lt(practiceAttempts.id, after.attemptId),
      ),
    ),
  );
};

/** Newest first; the ID breaks ties between attempts saved in the same instant. */
const NEWEST_FIRST = [
  desc(practiceAttempts.createdAt),
  desc(practiceAttempts.id),
] as const;

/** The User's attempts strictly after the cursor in the newest-first order. */
const ownedAfter = (userId: string, after: OwnAttemptCursor | undefined) => {
  const owned = eq(practiceAttempts.userId, userId);
  if (!after) {
    return owned;
  }
  const createdAt = new Date(after.createdAt);
  return and(
    owned,
    or(
      lt(practiceAttempts.createdAt, createdAt),
      and(
        eq(practiceAttempts.createdAt, createdAt),
        lt(practiceAttempts.id, after.attemptId),
      ),
    ),
  );
};
