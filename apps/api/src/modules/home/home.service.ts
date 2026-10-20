import { Injectable } from '@nestjs/common';
import type { HomeFeed, Locale } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { decodeHomeCursor, encodeHomeCursor } from './home-cursor.js';
import { type StoredHomeFeed } from './home-feed.js';
import { HomeFeedService } from './home-feed.service.js';
import { DEFAULT_HOME_LOCALE, HOME_PAGE_SIZE } from './home-rules.js';

export type HomePage = {
  page: HomeFeed;
  /** False when the response must not be stored by any cache. */
  cacheable: boolean;
};

/** One page of a feed: its rows from `position`, and where the next one starts. */
const pageOf = (feed: StoredHomeFeed, position: number): HomeFeed => {
  const end = position + HOME_PAGE_SIZE;
  return {
    audience: feed.audience,
    version: feed.version,
    algorithmVersion: feed.algorithmVersion,
    rows: feed.rows.slice(position, end),
    nextCursor:
      end < feed.rows.length
        ? encodeHomeCursor({ version: feed.version, position: end })
        : null,
  };
};

/**
 * Serves the home feed a request asks for. The first page comes from the
 * current feed; a cursor resumes the version it was issued for, so a feed
 * regenerated in between never shifts the rows of the visit.
 */
@Injectable()
export class HomeService {
  constructor(private readonly feeds: HomeFeedService) {}

  /**
   * The first page is the locale's current feed; a cursor names its own feed
   * version, so the locale is ignored for it.
   */
  async getPage(
    cursor: string | undefined,
    locale: Locale = DEFAULT_HOME_LOCALE,
  ): Promise<HomePage> {
    if (cursor === undefined) {
      const { feed, cacheable } = await this.feeds.currentPublic(locale);
      return { page: pageOf(feed, 0), cacheable };
    }
    const { version, position } = decodeHomeCursor(cursor);
    const feed = await this.feeds.publicVersion(version);
    if (!feed) {
      // Not a 410 with its own code: that code would need a translation in
      // every client. The client restarts from the first page on this one.
      throw new AppException(
        'NOT_FOUND',
        'This home feed version is no longer served; start again from the first page',
        { reason: 'FEED_VERSION_EXPIRED' },
      );
    }
    return { page: pageOf(feed, position), cacheable: true };
  }
}
