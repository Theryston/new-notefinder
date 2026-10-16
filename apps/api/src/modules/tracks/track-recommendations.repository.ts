import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TrackRecommendations } from '@notefinder/contracts';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import { tracks } from '../../database/schema/tracks.js';

@Injectable()
export class TrackRecommendationsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findRecommendations(
    trackId: string,
  ): Promise<TrackRecommendations | undefined> {
    const source = await this.txHost.tx.query.tracks.findFirst({
      where: eq(tracks.id, trackId),
      columns: {
        artistCredit: true,
        vocalRangeLowest: true,
        vocalRangeHighest: true,
      },
    });
    if (!source) return undefined;
    // Credits exist before the asynchronous metadata import links Artist rows.
    // Prefer MBID identity, retaining name matching only for older credits.
    const sameArtist = sql`exists (
      select 1 from jsonb_array_elements(${tracks.artistCredit}) candidate,
        jsonb_array_elements(${JSON.stringify(source.artistCredit)}::jsonb) origin
      where case when candidate->>'mbid' is not null and origin->>'mbid' is not null
        then candidate->>'mbid' = origin->>'mbid'
        else lower(candidate->>'name') = lower(origin->>'name') end
    )`;
    const hasRange =
      source.vocalRangeLowest !== null && source.vocalRangeHighest !== null;
    const distance = hasRange
      ? sql`abs(${tracks.vocalRangeLowest} - ${source.vocalRangeLowest}) + abs(${tracks.vocalRangeHighest} - ${source.vocalRangeHighest})`
      : sql`null`;
    const priority = sql`case when ${sameArtist} then 0 when ${distance} is not null then 1 else 2 end`;
    const rows = await this.txHost.tx
      .select({
        id: tracks.id,
        title: tracks.title,
        coverUrl: tracks.coverUrl,
        artistCredit: tracks.artistCredit,
      })
      .from(tracks)
      .where(and(ne(tracks.id, trackId), hasCompletedProcessing(tracks.id)))
      .orderBy(
        asc(priority),
        sql`case when ${priority} = 1 then ${distance} else 0 end`,
        desc(tracks.trendingScore),
        asc(tracks.id),
      )
      .limit(7);
    return { tracks: rows };
  }
}
