import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { dailyPracticeStreaks } from '../../database/schema/daily-practice-streaks.js';
import { practiceAttempts } from '../../database/schema/practice-attempts.js';
import { trackCooccurrences } from '../../database/schema/track-cooccurrences.js';
import { trackFavorites } from '../../database/schema/track-favorites.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import {
  type StoredArtistCreditEntry,
  tracks,
} from '../../database/schema/tracks.js';
import type {
  PersonalTrackCandidate,
  UserFavoriteSignal,
  UserTrackSignal,
} from './home-personal.repository.types.js';
import { PersonalHomeTasteRepository } from './home-personal-taste.repository.js';

export type {
  PersonalTrackCandidate,
  UserFavoriteSignal,
  UserTrackSignal,
} from './home-personal.repository.types.js';

/** The artist key the composer's per-row cap and the taste count by. */
const signalArtistKey = (
  credit: StoredArtistCreditEntry[],
  trackId: string,
): string => credit[0]?.mbid ?? credit[0]?.name ?? trackId;

/**
 * The User signals the personal feed blends in. The attempt and favorite
 * tables belong to their own features; this repository reads the aggregates
 * the feed builder needs so the home module never imports those modules (both
 * of them schedule through the home's queue, which would be a module cycle).
 */
@Injectable()
export class PersonalHomeRepository {
  constructor(
    private readonly txHost: TransactionHost<DatabaseAdapter>,
    private readonly tasteRepository: PersonalHomeTasteRepository,
  ) {}

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

  async findUserFavoriteSignals(userId: string): Promise<UserFavoriteSignal[]> {
    const rows = await this.txHost.tx
      .select({
        trackId: trackFavorites.trackId,
        genres: tracks.genres,
        credit: tracks.artistCredit,
        createdAt: trackFavorites.createdAt,
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
      createdAt: row.createdAt,
    }));
  }

  /** Rebuilds the bounded, global co-occurrence ranking consumed by personal feeds. */
  async refreshCommunityCooccurrence(): Promise<void> {
    await this.txHost.tx.transaction(async (transaction) => {
      const result = await transaction.execute<{
        sourceTrackId: string;
        targetTrackId: string;
        singerCount: number;
      }>(sql`
        with signals as (
          select distinct user_id, track_id from ${practiceAttempts}
          where forward_skip = false and bleed_suspected = false
          union
          select user_id, track_id from ${trackFavorites}
        ), pairs as (
          select source.track_id as "sourceTrackId",
            target.track_id as "targetTrackId",
            count(distinct source.user_id)::int as "singerCount"
          from signals source
          inner join signals target on target.user_id = source.user_id
          where target.track_id <> source.track_id
          group by source.track_id, target.track_id
          having count(distinct source.user_id) >= 2
        ), ranked as (
          select "sourceTrackId", "targetTrackId", "singerCount",
            row_number() over (
              partition by "sourceTrackId"
              order by "singerCount" desc, "targetTrackId" asc
            ) as rank
          from pairs
        )
        select "sourceTrackId", "targetTrackId", "singerCount"
        from ranked where rank <= 12
      `);
      await transaction.delete(trackCooccurrences);
      if (result.rows.length > 0) {
        await transaction.insert(trackCooccurrences).values(result.rows);
      }
    });
  }

  async findCommunityCooccurrence(
    sourceTrackIds: string[],
  ): Promise<
    { sourceTrackId: string; targetTrackId: string; singers: number }[]
  > {
    if (sourceTrackIds.length === 0) {
      return [];
    }
    const rows = await this.txHost.tx
      .select({
        sourceTrackId: trackCooccurrences.sourceTrackId,
        targetTrackId: trackCooccurrences.targetTrackId,
        singers: trackCooccurrences.singerCount,
      })
      .from(trackCooccurrences)
      .where(inArray(trackCooccurrences.sourceTrackId, sourceTrackIds))
      .orderBy(
        desc(trackCooccurrences.singerCount),
        trackCooccurrences.targetTrackId,
      );
    return rows;
  }

  findUserSungTrackSources(
    userId: string,
    limit: number,
  ): Promise<{ trackId: string; lastAttemptAt: Date }[]> {
    return this.txHost.tx
      .select({
        trackId: practiceAttempts.trackId,
        lastAttemptAt: sql<Date>`max(${practiceAttempts.createdAt})`.mapWith(
          practiceAttempts.createdAt,
        ),
      })
      .from(practiceAttempts)
      .where(
        and(
          eq(practiceAttempts.userId, userId),
          eq(practiceAttempts.forwardSkip, false),
          eq(practiceAttempts.bleedSuspected, false),
        ),
      )
      .groupBy(practiceAttempts.trackId)
      .orderBy(desc(sql`max(${practiceAttempts.createdAt})`))
      .limit(limit);
  }

  async findCommunityTrackCards(
    ids: string[],
  ): Promise<PersonalTrackCandidate[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.txHost.tx
      .select({
        id: tracks.id,
        title: tracks.title,
        coverUrl: tracks.coverUrl,
        artistCredit: tracks.artistCredit,
        durationMs: tracks.lengthMs,
        vocalRangeLowest: tracks.vocalRangeLowest,
        vocalRangeHighest: tracks.vocalRangeHighest,
        genres: tracks.genres,
        trendingScore: tracks.trendingScore,
      })
      .from(tracks)
      .where(and(hasCompletedProcessing(tracks.id), inArray(tracks.id, ids)));
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }

  async findTracksOutsideGenres(
    genres: string[],
    limit: number,
  ): Promise<PersonalTrackCandidate[]> {
    if (genres.length === 0) return [];
    return this.tasteRepository.findTracksOutsideGenres(genres, limit);
  }

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
