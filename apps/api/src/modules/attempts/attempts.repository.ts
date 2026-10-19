import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, count, desc, eq, lt, or, sql } from 'drizzle-orm';
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
 * The runs of a User that share a Track, a transposition and their flags, with
 * the best accuracy among them. Enough for the Vocal range: a group holds an
 * accurate run exactly when its best accuracy reaches the threshold.
 */
export type VocalRangeGroupRow = {
  // Null for a Track without notes.
  trackVocalRangeLowest: number | null;
  trackVocalRangeHighest: number | null;
  transposeSemitones: number;
  forwardSkip: boolean;
  bleedSuspected: boolean;
  bestAccuracy: number;
};

/**
 * The runs of a User on the Tracks of one artist, split by the bleed flag,
 * with how many there are and when the latest one was saved.
 */
export type ArtistGroupRow = {
  artistId: string;
  artistName: string;
  bleedSuspected: boolean;
  attempts: number;
  lastAttemptAt: Date;
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

  /**
   * How many runs the User saved that were not flagged as bleed: the runs
   * that count as sung.
   */
  async countSung(userId: string): Promise<number> {
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(practiceAttempts)
      .where(
        and(
          eq(practiceAttempts.userId, userId),
          eq(practiceAttempts.bleedSuspected, false),
        ),
      );
    return row?.value ?? 0;
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
   * The User's runs on Tracks with a vocal range, grouped by Track,
   * transposition and flags, so the read grows with the distinct combinations
   * rather than with the number of runs.
   */
  listVocalRangeGroups(userId: string): Promise<VocalRangeGroupRow[]> {
    return this.txHost.tx
      .select({
        trackVocalRangeLowest: tracks.vocalRangeLowest,
        trackVocalRangeHighest: tracks.vocalRangeHighest,
        transposeSemitones: practiceAttempts.transposeSemitones,
        forwardSkip: practiceAttempts.forwardSkip,
        bleedSuspected: practiceAttempts.bleedSuspected,
        bestAccuracy: sql<number>`max(${practiceAttempts.accuracy})`,
      })
      .from(practiceAttempts)
      .innerJoin(tracks, eq(tracks.id, practiceAttempts.trackId))
      .where(eq(practiceAttempts.userId, userId))
      .groupBy(
        tracks.id,
        tracks.vocalRangeLowest,
        tracks.vocalRangeHighest,
        practiceAttempts.transposeSemitones,
        practiceAttempts.forwardSkip,
        practiceAttempts.bleedSuspected,
      );
  }

  /**
   * The User's runs per credited artist, split by the bleed flag: one row per
   * artist and flag, counting the runs on that artist's Tracks.
   */
  listArtistGroups(userId: string): Promise<ArtistGroupRow[]> {
    return this.txHost.tx
      .select({
        artistId: artists.id,
        artistName: artists.name,
        bleedSuspected: practiceAttempts.bleedSuspected,
        attempts: sql<number>`count(*)::int`,
        // Mapped through the column, so the driver's timestamp becomes a Date.
        lastAttemptAt: sql<Date>`max(${practiceAttempts.createdAt})`.mapWith(
          practiceAttempts.createdAt,
        ),
      })
      .from(practiceAttempts)
      .innerJoin(
        trackArtists,
        eq(trackArtists.trackId, practiceAttempts.trackId),
      )
      .innerJoin(artists, eq(artists.id, trackArtists.artistId))
      .where(eq(practiceAttempts.userId, userId))
      .groupBy(artists.id, artists.name, practiceAttempts.bleedSuspected);
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
