import { Injectable } from '@nestjs/common';
import type { SitemapQuery, UserSitemapPage } from '@notefinder/contracts';
import { listSitemapPage } from '../../common/sitemap/sitemap-page.js';
import { UserSitemapRepository } from './user-sitemap.repository.js';

/** The Users sitemap: the Users with a Username, in ID order. */
@Injectable()
export class UserSitemapService {
  constructor(private readonly sitemap: UserSitemapRepository) {}

  list(query: SitemapQuery): Promise<UserSitemapPage> {
    return listSitemapPage(query, (after, take) =>
      this.sitemap.listAfter({ after, limit: take }),
    );
  }
}
