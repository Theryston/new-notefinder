import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { artists, trackArtists } from '../../database/schema/artists.js';
import {
  practiceAttempts,
  type practiceDifficulty,
} from '../../database/schema/practice-attempts.js';
import { tracks } from '../../database/schema/tracks.js';
import type { OwnAttemptCursor } from './own-attempt-cursor.js';

type Difficulty = (typeof practiceDifficulty.enumValues)[number];

/** A saved practice run, as the database keeps it. */
export type PracticeAttemptRow = typeof practiceAttempts.$inferSelect;

/**
 * One artist credited on the Track of an attempt. An attempt on a Track with
 * several artists comes back once per artist, so the service regroups them.
 * `artistId` is null for a Track no artist is linked to yet.
 */
export type ProfileAttemptRow = {
  attemptId: string;
  transposeSemitones: number;
  accuracy: number;
  forwardSkip: boolean;
  bleedSuspected: boolean;
  createdAt: Date;
  trackVocalRangeLowest: number | null;
  trackVocalRangeHighest: number | null;
  artistId: string | null;
  artistName: string | null;
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

  /**
   * Every attempt of the User with its Track's vocal range and artists, for
   * the Profile chips. Unordered: the rules are order-independent.
   */
  listProfileAttempts(userId: string): Promise<ProfileAttemptRow[]> {
    return this.txHost.tx
      .select({
        attemptId: practiceAttempts.id,
        transposeSemitones: practiceAttempts.transposeSemitones,
        accuracy: practiceAttempts.accuracy,
        forwardSkip: practiceAttempts.forwardSkip,
        bleedSuspected: practiceAttempts.bleedSuspected,
        createdAt: practiceAttempts.createdAt,
        trackVocalRangeLowest: tracks.vocalRangeLowest,
        trackVocalRangeHighest: tracks.vocalRangeHighest,
        artistId: artists.id,
        artistName: artists.name,
      })
      .from(practiceAttempts)
      .innerJoin(tracks, eq(tracks.id, practiceAttempts.trackId))
      .leftJoin(trackArtists, eq(trackArtists.trackId, tracks.id))
      .leftJoin(artists, eq(artists.id, trackArtists.artistId))
      .where(eq(practiceAttempts.userId, userId));
  }

  /** Up to `limit` attempts of the User after the cursor, newest first. */
  listOwn(options: {
    userId: string;
    after: OwnAttemptCursor | undefined;
    limit: number;
  }): Promise<PracticeAttemptRow[]> {
    const { userId, after, limit } = options;
    const owned = eq(practiceAttempts.userId, userId);
    // Newest first, so the page after holds the older rows; the ID breaks
    // ties between attempts saved in the same instant.
    const afterCursor =
      after &&
      or(
        lt(practiceAttempts.createdAt, new Date(after.createdAt)),
        and(
          eq(practiceAttempts.createdAt, new Date(after.createdAt)),
          lt(practiceAttempts.id, after.attemptId),
        ),
      );
    return this.txHost.tx
      .select()
      .from(practiceAttempts)
      .where(afterCursor ? and(owned, afterCursor) : owned)
      .orderBy(desc(practiceAttempts.createdAt), desc(practiceAttempts.id))
      .limit(limit);
  }
}
