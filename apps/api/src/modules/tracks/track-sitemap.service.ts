import { Injectable } from '@nestjs/common';
import type {
  ListTrackSitemapQuery,
  TrackSitemapPage,
} from '@notefinder/contracts';
import { TrackSitemapRepository } from './track-sitemap.repository.js';
import {
  decodeTrackSitemapCursor,
  encodeTrackSitemapCursor,
} from './track-sitemap-cursor.js';

/** The Tracks sitemap: completed Tracks, the highest trending score first. */
@Injectable()
export class TrackSitemapService {
  constructor(private readonly sitemap: TrackSitemapRepository) {}

  async list(query: ListTrackSitemapQuery): Promise<TrackSitemapPage> {
    const rows = await this.sitemap.listCompleted({
      after: query.cursor ? decodeTrackSitemapCursor(query.cursor) : undefined,
      // One more than asked tells whether another page follows.
      limit: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        id: row.id,
        updatedAt: row.updatedAt.toISOString(),
      })),
      nextCursor:
        rows.length > query.limit && last
          ? encodeTrackSitemapCursor({
              score: last.trendingScore,
              trackId: last.id,
            })
          : null,
    };
  }
}
