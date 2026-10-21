import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  sql,
} from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { practiceAttempts } from '../../database/schema/practice-attempts.js';
import { trackFavorites } from '../../database/schema/track-favorites.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import { tracks } from '../../database/schema/tracks.js';
import type { TrackSignalCount } from './home-popularity.js';

/** A Track as the home's candidate queries read it. */
export type HomeTrackRecord = {
  id: string;
  title: string;
  coverUrl: string | null;
  artistCredit: { name: string; joinPhrase: string; mbid?: string }[];
  lengthMs: number | null;
  vocalRangeLowest: number | null;
  vocalRangeHighest: number | null;
  /**
   * The views-based trending score, read with the record so the weekly Top 10
   * can blend it with the singing signal. Sources that don't rank by it leave
   * it out, so it is optional and defaults to 0 where it is read.
   */
  trendingScore?: number;
};

const candidateColumns = {
  id: tracks.id,
  title: tracks.title,
  coverUrl: tracks.coverUrl,
  artistCredit: tracks.artistCredit,
  lengthMs: tracks.lengthMs,
  vocalRangeLowest: tracks.vocalRangeLowest,
  vocalRangeHighest: tracks.vocalRangeHighest,
  trendingScore: tracks.trendingScore,
};

/**
 * The Tracks the home can show: only Tracks whose Processing completed
 * (ADR 0005). The queries read a bounded list, best first; the composer
 * decides the rest.
 */
@Injectable()
export class HomeRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** Completed Tracks with a trending score, hottest first. */
  findTrendingTracks(limit: number): Promise<HomeTrackRecord[]> {
    return this.txHost.tx
      .select(candidateColumns)
      .from(tracks)
      .where(
        and(hasCompletedProcessing(tracks.id), gt(tracks.trendingScore, 0)),
      )
      .orderBy(desc(tracks.trendingScore), asc(tracks.id))
      .limit(limit);
  }

  /** The completed Tracks among `ids`, in no particular order. */
  findCompletedTracksByIds(ids: string[]): Promise<HomeTrackRecord[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.txHost.tx
      .select(candidateColumns)
      .from(tracks)
      .where(and(hasCompletedProcessing(tracks.id), inArray(tracks.id, ids)));
  }

  /** Completed Tracks with a stored Vocal range, hottest first. */
  findTracksWithVocalRange(limit: number): Promise<HomeTrackRecord[]> {
    return this.txHost.tx
      .select(candidateColumns)
      .from(tracks)
      .where(
        and(
          hasCompletedProcessing(tracks.id),
          isNotNull(tracks.vocalRangeLowest),
          isNotNull(tracks.vocalRangeHighest),
        ),
      )
      .orderBy(desc(tracks.trendingScore), asc(tracks.id))
      .limit(limit);
  }

  /** Completed Tracks, newest first. */
  findNewestTracks(limit: number): Promise<HomeTrackRecord[]> {
    return this.txHost.tx
      .select(candidateColumns)
      .from(tracks)
      .where(hasCompletedProcessing(tracks.id))
      .orderBy(desc(tracks.createdAt), desc(tracks.id))
      .limit(limit);
  }

  /**
   * Completed Tracks by valid Attempts since `since`, most sung first. Only
   * runs without a forward skip and without a suspected bleed count as
   * singing; ties keep Track id order, so the row is stable.
   */
  findMostSungTrackIds(
    limit: number,
    since: Date,
  ): Promise<TrackSignalCount[]> {
    return this.txHost.tx
      .select({
        trackId: practiceAttempts.trackId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(practiceAttempts)
      .innerJoin(tracks, eq(practiceAttempts.trackId, tracks.id))
      .where(
        and(
          hasCompletedProcessing(tracks.id),
          eq(practiceAttempts.forwardSkip, false),
          eq(practiceAttempts.bleedSuspected, false),
          gte(practiceAttempts.createdAt, since),
        ),
      )
      .groupBy(practiceAttempts.trackId)
      .orderBy(desc(sql`count(*)`), asc(practiceAttempts.trackId))
      .limit(limit);
  }

  /**
   * Completed Tracks by favorites since `since`, most favorited first. Ties
   * keep Track id order, like the sung row.
   */
  findMostFavoritedTrackIds(
    limit: number,
    since: Date,
  ): Promise<TrackSignalCount[]> {
    return this.txHost.tx
      .select({
        trackId: trackFavorites.trackId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(trackFavorites)
      .innerJoin(tracks, eq(trackFavorites.trackId, tracks.id))
      .where(
        and(
          hasCompletedProcessing(tracks.id),
          gte(trackFavorites.createdAt, since),
        ),
      )
      .groupBy(trackFavorites.trackId)
      .orderBy(desc(sql`count(*)`), asc(trackFavorites.trackId))
      .limit(limit);
  }

  /** Valid Attempts since `since` of the given Tracks, one row per Track. */
  countRecentAttempts(
    trackIds: string[],
    since: Date,
  ): Promise<TrackSignalCount[]> {
    if (trackIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.txHost.tx
      .select({
        trackId: practiceAttempts.trackId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(practiceAttempts)
      .where(
        and(
          inArray(practiceAttempts.trackId, trackIds),
          eq(practiceAttempts.forwardSkip, false),
          eq(practiceAttempts.bleedSuspected, false),
          gte(practiceAttempts.createdAt, since),
        ),
      )
      .groupBy(practiceAttempts.trackId);
  }

  /** Favorites since `since` of the given Tracks, one row per Track. */
  countRecentFavorites(
    trackIds: string[],
    since: Date,
  ): Promise<TrackSignalCount[]> {
    if (trackIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.txHost.tx
      .select({
        trackId: trackFavorites.trackId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(trackFavorites)
      .where(
        and(
          inArray(trackFavorites.trackId, trackIds),
          gte(trackFavorites.createdAt, since),
        ),
      )
      .groupBy(trackFavorites.trackId);
  }
}
