import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, gt, inArray } from 'drizzle-orm';
import type { SitemapRow } from '../../common/sitemap/sitemap-page.js';
import type { DatabaseAdapter } from '../../database/database.js';
import { artists, trackArtists } from '../../database/schema/artists.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';

/** The Artists with a completed Track, in ID order. */
@Injectable()
export class ArtistSitemapRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** Up to `limit` listed Artists with an ID after `after`, in ID order. */
  listAfter(options: {
    after: string | undefined;
    limit: number;
  }): Promise<SitemapRow[]> {
    const { after, limit } = options;
    const listed = inArray(
      artists.id,
      this.txHost.tx
        .select({ id: trackArtists.artistId })
        .from(trackArtists)
        .where(hasCompletedProcessing(trackArtists.trackId)),
    );
    return this.txHost.tx
      .select({ id: artists.id, updatedAt: artists.updatedAt })
      .from(artists)
      .where(and(listed, after ? gt(artists.id, after) : undefined))
      .orderBy(asc(artists.id))
      .limit(limit);
  }
}
