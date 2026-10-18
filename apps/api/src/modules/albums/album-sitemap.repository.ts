import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, gt, inArray } from 'drizzle-orm';
import type { SitemapRow } from '../../common/sitemap/sitemap-page.js';
import type { DatabaseAdapter } from '../../database/database.js';
import { albums, albumTracks } from '../../database/schema/albums.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';

/** The Albums with a completed Track, in ID order. */
@Injectable()
export class AlbumSitemapRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** Up to `limit` listed Albums with an ID after `after`, in ID order. */
  listAfter(options: {
    after: string | undefined;
    limit: number;
  }): Promise<SitemapRow[]> {
    const { after, limit } = options;
    const listed = inArray(
      albums.id,
      this.txHost.tx
        .select({ id: albumTracks.albumId })
        .from(albumTracks)
        .where(hasCompletedProcessing(albumTracks.trackId)),
    );
    return this.txHost.tx
      .select({ id: albums.id, updatedAt: albums.updatedAt })
      .from(albums)
      .where(and(listed, after ? gt(albums.id, after) : undefined))
      .orderBy(asc(albums.id))
      .limit(limit);
  }
}
