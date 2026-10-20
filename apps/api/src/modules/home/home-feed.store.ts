import { Injectable } from '@nestjs/common';
import type { Locale } from '@notefinder/contracts';
import { CacheService } from '../../redis/cache.service.js';
import { type StoredHomeFeed, storedHomeFeedSchema } from './home-feed.js';
import {
  HOME_FEED_CURRENT_TTL_SECONDS,
  HOME_FEED_LOCK_TTL_SECONDS,
  HOME_FEED_RETAINED_TTL_SECONDS,
} from './home-rules.js';

// A feed's version is a hash that includes its locale, so a retained feed is
// keyed by its version alone.
const currentKey = (locale: Locale): string => `home:public:${locale}:current`;
const lockKey = (locale: Locale): string => `home:public:${locale}:lock`;
const retainedKey = (version: string): string =>
  `home:public:version:${version}`;

/**
 * The public feeds' Redis entries, per locale: the current feed and the build
 * lock, plus the feeds a regeneration replaced (kept for cursors still in
 * flight, by version). Every call
 * goes through the shared cache, which fails open.
 */
@Injectable()
export class HomeFeedStore {
  constructor(private readonly cache: CacheService) {}

  readCurrent(locale: Locale): Promise<StoredHomeFeed | undefined> {
    return this.cache.get(currentKey(locale), storedHomeFeedSchema);
  }

  writeCurrent(locale: Locale, feed: StoredHomeFeed): Promise<void> {
    return this.cache.set(
      currentKey(locale),
      feed,
      HOME_FEED_CURRENT_TTL_SECONDS,
    );
  }

  retire(feed: StoredHomeFeed): Promise<void> {
    return this.cache.set(
      retainedKey(feed.version),
      feed,
      HOME_FEED_RETAINED_TTL_SECONDS,
    );
  }

  readRetired(version: string): Promise<StoredHomeFeed | undefined> {
    return this.cache.get(retainedKey(version), storedHomeFeedSchema);
  }

  acquireLock(locale: Locale): Promise<boolean> {
    return this.cache.acquire(lockKey(locale), HOME_FEED_LOCK_TTL_SECONDS);
  }

  releaseLock(locale: Locale): Promise<void> {
    return this.cache.del(lockKey(locale));
  }
}
