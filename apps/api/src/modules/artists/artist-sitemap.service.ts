import { Injectable } from '@nestjs/common';
import type { ArtistSitemapPage, SitemapQuery } from '@notefinder/contracts';
import { listSitemapPage } from '../../common/sitemap/sitemap-page.js';
import { ArtistSitemapRepository } from './artist-sitemap.repository.js';

/** The Artists sitemap: the Artists with a completed Track, in ID order. */
@Injectable()
export class ArtistSitemapService {
  constructor(private readonly sitemap: ArtistSitemapRepository) {}

  list(query: SitemapQuery): Promise<ArtistSitemapPage> {
    return listSitemapPage(query, (after, take) =>
      this.sitemap.listAfter({ after, limit: take }),
    );
  }
}
