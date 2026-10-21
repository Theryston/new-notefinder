import { Injectable, Optional } from '@nestjs/common';
import type { HomeFeed, Locale } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { decodeHomeCursor, encodeHomeCursor } from './home-cursor.js';
import { type StoredHomeFeed } from './home-feed.js';
import { HomeFeedService } from './home-feed.service.js';
import { HomePinOverlayService } from './home-pin-overlay.service.js';
import {
  DEFAULT_HOME_LOCALE,
  HOME_PAGE_SIZE,
  PRIVATE_HOME_CACHE_CONTROL,
  PUBLIC_HOME_CACHE_CONTROL,
  UNCACHED_HOME_CACHE_CONTROL,
} from './home-rules.js';

export type HomePage = {
  page: HomeFeed;
  /** False when the response must not be stored by any cache. */
  cacheable: boolean;
  /** The `Cache-Control` header the response is sent with. */
  cacheControl: string;
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

const cacheControlOf = (cacheable: boolean, signedIn: boolean): string => {
  if (!cacheable) {
    return UNCACHED_HOME_CACHE_CONTROL;
  }
  return signedIn ? PRIVATE_HOME_CACHE_CONTROL : PUBLIC_HOME_CACHE_CONTROL;
};

/**
 * Serves the home feed a request asks for. The first page comes from the
 * locale's current feed; a cursor resumes the version it was issued for, so a
 * feed regenerated in between never shifts the rows of the visit. The live
 * editorial pins are overlaid on the stored rows per request.
 */
@Injectable()
export class HomeService {
  constructor(
    private readonly feeds: HomeFeedService,
    // Optional only so the feed can be served without the pin overlay (the feed
    // specs provide the feed service alone). HomeModule always provides it.
    @Optional() private readonly pinOverlay?: HomePinOverlayService,
  ) {}

  /**
   * The first page is the locale's current feed. A cursor names its own feed
   * version, and the locale is the one that feed was built for, so the `locale`
   * argument is ignored for it. The minimal home is never overlaid.
   */
  async getPage(
    cursor: string | undefined,
    locale: Locale = DEFAULT_HOME_LOCALE,
    signedIn = false,
  ): Promise<HomePage> {
    if (cursor === undefined) {
      const { feed, cacheable } = await this.feeds.currentPublic(locale);
      const shown = cacheable
        ? await this.withPins(feed, locale, signedIn)
        : feed;
      return this.answer(shown, 0, cacheable, signedIn);
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
    const feedLocale = feed.locale ?? DEFAULT_HOME_LOCALE;
    const shown = await this.withPins(feed, feedLocale, signedIn);
    return this.answer(shown, position, true, signedIn);
  }

  private async withPins(
    feed: StoredHomeFeed,
    locale: Locale,
    signedIn: boolean,
  ): Promise<StoredHomeFeed> {
    if (!this.pinOverlay) {
      return feed;
    }
    const rows = await this.pinOverlay.apply(feed.rows, { locale, signedIn });
    return { ...feed, rows };
  }

  private answer(
    feed: StoredHomeFeed,
    position: number,
    cacheable: boolean,
    signedIn: boolean,
  ): HomePage {
    return {
      page: pageOf(feed, position),
      cacheable,
      cacheControl: cacheControlOf(cacheable, signedIn),
    };
  }
}
