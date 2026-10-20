import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, desc, gt } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import { tracks } from '../../database/schema/tracks.js';

/** A Track as the home's candidate queries read it. */
export type HomeTrackRecord = {
  id: string;
  title: string;
  coverUrl: string | null;
  artistCredit: { name: string; joinPhrase: string; mbid?: string }[];
  lengthMs: number | null;
  vocalRangeLowest: number | null;
  vocalRangeHighest: number | null;
};

const candidateColumns = {
  id: tracks.id,
  title: tracks.title,
  coverUrl: tracks.coverUrl,
  artistCredit: tracks.artistCredit,
  lengthMs: tracks.lengthMs,
  vocalRangeLowest: tracks.vocalRangeLowest,
  vocalRangeHighest: tracks.vocalRangeHighest,
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

  /** Completed Tracks, newest first. */
  findNewestTracks(limit: number): Promise<HomeTrackRecord[]> {
    return this.txHost.tx
      .select(candidateColumns)
      .from(tracks)
      .where(hasCompletedProcessing(tracks.id))
      .orderBy(desc(tracks.createdAt), desc(tracks.id))
      .limit(limit);
  }
}
