import { Injectable } from '@nestjs/common';
import type { AlbumSitemapPage, SitemapQuery } from '@notefinder/contracts';
import { listSitemapPage } from '../../common/sitemap/sitemap-page.js';
import { AlbumSitemapRepository } from './album-sitemap.repository.js';

/** The Albums sitemap: the Albums with a completed Track, in ID order. */
@Injectable()
export class AlbumSitemapService {
  constructor(private readonly sitemap: AlbumSitemapRepository) {}

  list(query: SitemapQuery): Promise<AlbumSitemapPage> {
    return listSitemapPage(query, (after, take) =>
      this.sitemap.listAfter({ after, limit: take }),
    );
  }
}
