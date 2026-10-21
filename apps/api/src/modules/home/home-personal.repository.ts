import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { dailyPracticeStreaks } from '../../database/schema/daily-practice-streaks.js';
import { practiceAttempts } from '../../database/schema/practice-attempts.js';
import { trackFavorites } from '../../database/schema/track-favorites.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import {
  type StoredArtistCreditEntry,
  tracks,
} from '../../database/schema/tracks.js';

/** The artist key the composer's per-row cap and the taste count by. */
const signalArtistKey = (
  credit: StoredArtistCreditEntry[],
  trackId: string,
): string => credit[0]?.mbid ?? credit[0]?.name ?? trackId;

/** One Track the User practiced, with what the resume rows show. */
export type UserTrackSignal = {
  trackId: string;
  attempts: number;
  bestAccuracy: number;
  lastAttemptAt: Date;
  genres: string[];
  artistKey: string;
  title: string;
  coverUrl: string | null;
  artistCredit: { name: string; joinPhrase: string }[];
  durationMs: number | null;
  vocalRangeLowest: number | null;
  vocalRangeHighest: number | null;
};

/** One Track the User favorited, with what the taste counts. */
export type UserFavoriteSignal = {
  trackId: string;
  genres: string[];
  artistKey: string;
};

/**
 * The User signals the personal feed blends in. The attempt and favorite
 * tables belong to their own features; this repository reads the aggregates
 * the feed builder needs so the home module never imports those modules (both
 * of them schedule through the home's queue, which would be a module cycle).
 */
@Injectable()
export class PersonalHomeRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * One row per Track the User practiced whose Processing completed, with the
   * run count, the best accuracy, the latest run and the card fields. Newest
   * run first, so the resume rows lead with where the User left off.
   */
  async findUserTrackSignals(userId: string): Promise<UserTrackSignal[]> {
    const rows = await this.txHost.tx
      .select({
        trackId: practiceAttempts.trackId,
        attempts: count(),
        bestAccuracy: sql<number>`max(${practiceAttempts.accuracy})`,
        lastAttemptAt: sql<Date>`max(${practiceAttempts.createdAt})`.mapWith(
          practiceAttempts.createdAt,
        ),
        genres: tracks.genres,
        credit: tracks.artistCredit,
        title: tracks.title,
        coverUrl: tracks.coverUrl,
        artistCredit: tracks.artistCredit,
        durationMs: tracks.lengthMs,
        vocalRangeLowest: tracks.vocalRangeLowest,
        vocalRangeHighest: tracks.vocalRangeHighest,
      })
      .from(practiceAttempts)
      .innerJoin(tracks, eq(tracks.id, practiceAttempts.trackId))
      .where(
        and(
          eq(practiceAttempts.userId, userId),
          hasCompletedProcessing(practiceAttempts.trackId),
        ),
      )
      .groupBy(
        practiceAttempts.trackId,
        tracks.genres,
        tracks.artistCredit,
        tracks.title,
        tracks.coverUrl,
        tracks.lengthMs,
        tracks.vocalRangeLowest,
        tracks.vocalRangeHighest,
      )
      .orderBy(desc(sql`max(${practiceAttempts.createdAt})`));
    return rows.map((row) => ({
      trackId: row.trackId,
      attempts: row.attempts,
      bestAccuracy: row.bestAccuracy,
      lastAttemptAt: row.lastAttemptAt,
      genres: row.genres,
      artistKey: signalArtistKey(row.credit, row.trackId),
      title: row.title,
      coverUrl: row.coverUrl,
      artistCredit: row.artistCredit.map(({ name, joinPhrase }) => ({
        name,
        joinPhrase,
      })),
      durationMs: row.durationMs,
      vocalRangeLowest: row.vocalRangeLowest,
      vocalRangeHighest: row.vocalRangeHighest,
    }));
  }

  /**
   * The Tracks the User favorited whose Processing completed, with what the
   * taste counts.
   */
  async findUserFavoriteSignals(userId: string): Promise<UserFavoriteSignal[]> {
    const rows = await this.txHost.tx
      .select({
        trackId: trackFavorites.trackId,
        genres: tracks.genres,
        credit: tracks.artistCredit,
      })
      .from(trackFavorites)
      .innerJoin(tracks, eq(tracks.id, trackFavorites.trackId))
      .where(
        and(
          eq(trackFavorites.userId, userId),
          hasCompletedProcessing(trackFavorites.trackId),
        ),
      );
    return rows.map((row) => ({
      trackId: row.trackId,
      genres: row.genres,
      artistKey: signalArtistKey(row.credit, row.trackId),
    }));
  }

  /** The trending scores of the Tracks given, keyed by Track. */
  async findTrendingScores(ids: string[]): Promise<Map<string, number>> {
    return new Map(
      [...(await this.findDiscoveryTracks(ids)).entries()].map(
        ([id, track]) => [id, track.trendingScore],
      ),
    );
  }

  /**
   * What the discovery blend needs of the Tracks given: their trending score
   * for the popularity, their genres and artist for the taste. Completed
   * Tracks only, like every home query.
   */
  async findDiscoveryTracks(
    ids: string[],
  ): Promise<
    Map<string, { trendingScore: number; genres: string[]; artistKey: string }>
  > {
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await this.txHost.tx
      .select({
        id: tracks.id,
        trendingScore: tracks.trendingScore,
        genres: tracks.genres,
        credit: tracks.artistCredit,
      })
      .from(tracks)
      .where(and(hasCompletedProcessing(tracks.id), inArray(tracks.id, ids)));
    return new Map(
      rows.map((row) => [
        row.id,
        {
          trendingScore: row.trendingScore,
          genres: row.genres,
          artistKey: signalArtistKey(row.credit, row.id),
        },
      ]),
    );
  }

  /**
   * The Users with an Attempt or a practice heartbeat since `since`: the ones
   * the nightly batch rebuilds. Capped, so a huge backlog can't flood the
   * queue; the cap is a home rule, passed in by the caller.
   */
  async findActiveUserIds(since: Date, limit: number): Promise<string[]> {
    const [attempted, heartbeated] = await Promise.all([
      this.txHost.tx
        .selectDistinct({ userId: practiceAttempts.userId })
        .from(practiceAttempts)
        .where(gte(practiceAttempts.createdAt, since)),
      this.txHost.tx
        .selectDistinct({ userId: dailyPracticeStreaks.userId })
        .from(dailyPracticeStreaks)
        .where(gte(dailyPracticeStreaks.lastHeartbeatAt, since)),
    ]);
    const union = new Set([
      ...attempted.map((row) => row.userId),
      ...heartbeated.map((row) => row.userId),
    ]);
    return [...union].slice(0, limit);
  }
}
