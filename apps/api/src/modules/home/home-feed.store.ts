import { Injectable } from '@nestjs/common';
import { CacheService } from '../../redis/cache.service.js';
import { type StoredHomeFeed, storedHomeFeedSchema } from './home-feed.js';
import {
  HOME_FEED_CURRENT_TTL_SECONDS,
  HOME_FEED_LOCK_TTL_SECONDS,
  HOME_FEED_RETAINED_TTL_SECONDS,
} from './home-rules.js';

const CURRENT_KEY = 'home:public:current';
const LOCK_KEY = 'home:public:lock';
const retainedKey = (version: string): string =>
  `home:public:version:${version}`;

/**
 * The public feed's Redis entries: the current feed, the feeds a regeneration
 * replaced (kept for cursors still in flight) and the build lock. Every call
 * goes through the shared cache, which fails open.
 */
@Injectable()
export class HomeFeedStore {
  constructor(private readonly cache: CacheService) {}

  readCurrent(): Promise<StoredHomeFeed | undefined> {
    return this.cache.get(CURRENT_KEY, storedHomeFeedSchema);
  }

  writeCurrent(feed: StoredHomeFeed): Promise<void> {
    return this.cache.set(CURRENT_KEY, feed, HOME_FEED_CURRENT_TTL_SECONDS);
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

  acquireLock(): Promise<boolean> {
    return this.cache.acquire(LOCK_KEY, HOME_FEED_LOCK_TTL_SECONDS);
  }

  releaseLock(): Promise<void> {
    return this.cache.del(LOCK_KEY);
  }
}
