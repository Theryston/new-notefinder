import { Test } from '@nestjs/testing';
import { CacheService } from '../../redis/cache.service.js';
import { type StoredHomeFeed } from './home-feed.js';
import { HomeFeedStore } from './home-feed.store.js';
import {
  HOME_FEED_CURRENT_TTL_SECONDS,
  HOME_FEED_LOCK_TTL_SECONDS,
  HOME_FEED_RETAINED_TTL_SECONDS,
} from './home-rules.js';

const feed: StoredHomeFeed = {
  audience: 'public',
  version: 'abc123',
  algorithmVersion: 1,
  rows: [],
};

describe('HomeFeedStore', () => {
  let store: HomeFeedStore;
  const cache = {
    get: vi.fn(),
    set: vi.fn(),
    acquire: vi.fn(),
    del: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [HomeFeedStore, { provide: CacheService, useValue: cache }],
    }).compile();
    store = moduleRef.get(HomeFeedStore);
  });

  it('keeps the current feed for the current TTL', async () => {
    await store.writeCurrent(feed);
    expect(cache.set).toHaveBeenCalledWith(
      'home:public:current',
      feed,
      HOME_FEED_CURRENT_TTL_SECONDS,
    );
  });

  it('reads the current feed with the stored-feed schema', async () => {
    cache.get.mockResolvedValue(feed);
    await expect(store.readCurrent()).resolves.toEqual(feed);
    expect(cache.get).toHaveBeenCalledWith(
      'home:public:current',
      expect.anything(),
    );
  });

  it('retains a replaced feed under its own version for the retained TTL', async () => {
    await store.retire(feed);
    expect(cache.set).toHaveBeenCalledWith(
      'home:public:version:abc123',
      feed,
      HOME_FEED_RETAINED_TTL_SECONDS,
    );
  });

  it('reads a retained feed by its version', async () => {
    cache.get.mockResolvedValue(feed);
    await expect(store.readRetired('abc123')).resolves.toEqual(feed);
    expect(cache.get).toHaveBeenCalledWith(
      'home:public:version:abc123',
      expect.anything(),
    );
  });

  it('takes and releases the build lock', async () => {
    cache.acquire.mockResolvedValue(true);
    await expect(store.acquireLock()).resolves.toBe(true);
    expect(cache.acquire).toHaveBeenCalledWith(
      'home:public:lock',
      HOME_FEED_LOCK_TTL_SECONDS,
    );
    await store.releaseLock();
    expect(cache.del).toHaveBeenCalledWith('home:public:lock');
  });
});
