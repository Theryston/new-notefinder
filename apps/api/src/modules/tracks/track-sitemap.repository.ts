import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, desc, eq, gt, lt, or } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import { tracks } from '../../database/schema/tracks.js';
import type { TrackSitemapCursor } from './track-sitemap-cursor.js';

/** A completed Track as the sitemap lists it. */
export type SitemapTrack = {
  id: string;
  trendingScore: number;
  updatedAt: Date;
};

/** The completed Tracks, hottest first. */
@Injectable()
export class TrackSitemapRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** Up to `limit` Tracks after the cursor: higher score first, ID breaks ties. */
  listCompleted(options: {
    after: TrackSitemapCursor | undefined;
    limit: number;
  }): Promise<SitemapTrack[]> {
    const { after, limit } = options;
    const completed = hasCompletedProcessing(tracks.id);
    // IDs ascend within a score, so the page after resumes past the last one.
    const afterCursor =
      after &&
      or(
        lt(tracks.trendingScore, after.score),
        and(
          eq(tracks.trendingScore, after.score),
          gt(tracks.id, after.trackId),
        ),
      );
    return this.txHost.tx
      .select({
        id: tracks.id,
        trendingScore: tracks.trendingScore,
        updatedAt: tracks.updatedAt,
      })
      .from(tracks)
      .where(afterCursor ? and(completed, afterCursor) : completed)
      .orderBy(desc(tracks.trendingScore), asc(tracks.id))
      .limit(limit);
  }
}
