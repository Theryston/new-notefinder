import type { CacheEntry } from 'next/dist/server/lib/cache-handlers/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFakeRedisClient,
  type FakeRedisClient,
  FakeRedisStore,
} from './fake-redis.ts';
import { createCacheHandlerFromEnv } from './redis.ts';
import {
  createRedisCacheHandler,
  type RedisCacheHandlerOptions,
  type TagsManifest,
} from './redis-cache-handler.ts';

const KEY = 'cache-key';
const MAX = { expire: 365 * 24 * 60 * 60 };

let clock: number;
let store: FakeRedisStore;

function streamOf(text: string) {
  return new Response(text).body ?? new ReadableStream<Uint8Array>();
}

function makeEntry(
  text: string,
  overrides: Partial<Omit<CacheEntry, 'value'>> = {},
): CacheEntry {
  return {
    value: streamOf(text),
    tags: [],
    stale: 300,
    timestamp: clock,
    revalidate: 900,
    expire: 3600,
    ...overrides,
  };
}

const readText = async (entry: CacheEntry | undefined) =>
  entry ? new Response(entry.value).text() : undefined;

/** One simulated Next instance: own local tier, own tags manifest. */
function createInstance(overrides: Partial<RedisCacheHandlerOptions> = {}) {
  const redis = createFakeRedisClient(store);
  const tagsManifest: TagsManifest = new Map();
  const warn = vi.fn();
  const logError = vi.fn();
  const handler = createRedisCacheHandler({
    redis,
    keyPrefix: 'test',
    buildId: 'build-1',
    tagsManifest,
    tagsSyncIntervalMs: 0,
    now: () => clock,
    warn,
    logError,
    ...overrides,
  });
  return { handler, redis, tagsManifest, warn, logError };
}

beforeEach(() => {
  clock = 1_700_000_000_000;
  store = new FakeRedisStore();
  store.now = () => clock;
});

describe('createRedisCacheHandler', () => {
  it('round-trips an entry through the local tier and Redis', async () => {
    const a = createInstance();
    const b = createInstance();
    await a.handler.set(
      KEY,
      Promise.resolve(makeEntry('hello', { tags: ['t'] })),
    );

    const fromA = await a.handler.get(KEY, []);
    expect(await readText(fromA)).toBe('hello');
    expect(fromA).toMatchObject({ tags: ['t'], revalidate: 900, expire: 3600 });

    // B never rendered it: it reads what A stored in Redis.
    const fromB = await b.handler.get(KEY, []);
    expect(await readText(fromB)).toBe('hello');
    expect(fromB).toMatchObject({ timestamp: clock, stale: 300 });
  });

  it('serves repeated reads from the local tier', async () => {
    const a = createInstance();
    const b = createInstance();
    await a.handler.set(KEY, Promise.resolve(makeEntry('hello')));
    await b.handler.get(KEY, []);
    b.redis.calls.length = 0;

    expect(await readText(await b.handler.get(KEY, []))).toBe('hello');
    expect(b.redis.calls).toEqual([]);
  });

  it('keeps entries apart per build', async () => {
    const a = createInstance();
    const next = createInstance({ buildId: 'build-2' });
    await a.handler.set(KEY, Promise.resolve(makeEntry('old build')));

    expect(await next.handler.get(KEY, [])).toBeUndefined();
  });

  it('stores entries with a TTL derived from expire', async () => {
    const a = createInstance();
    await a.handler.set(KEY, Promise.resolve(makeEntry('x', { expire: 120 })));

    const [redisKey] = [...store.data.keys()];
    expect(store.ttl(String(redisKey))).toBe(120_000);
  });

  it('caps the TTL to the tag retention', async () => {
    const a = createInstance({ retentionMs: 60_000 });
    await a.handler.set(KEY, Promise.resolve(makeEntry('x', { expire: 3600 })));

    const [redisKey] = [...store.data.keys()];
    expect(store.ttl(String(redisKey))).toBe(60_000);
  });

  it('serves stale entries until expire, then drops them', async () => {
    const a = createInstance();
    await a.handler.set(
      KEY,
      Promise.resolve(makeEntry('x', { revalidate: 10, expire: 60 })),
    );

    clock += 30_000;
    // Past `revalidate`: returned so Next serves it and refreshes it.
    expect(await readText(await a.handler.get(KEY, []))).toBe('x');

    clock += 31_000;
    expect(await a.handler.get(KEY, [])).toBeUndefined();
    expect(await createInstance().handler.get(KEY, [])).toBeUndefined();
  });

  it('does not store entries with expire 0', async () => {
    const a = createInstance();
    await a.handler.set(KEY, Promise.resolve(makeEntry('x', { expire: 0 })));

    expect(await a.handler.get(KEY, [])).toBeUndefined();
    expect(store.data.size).toBe(0);
  });

  it('discards an entry whose stream errors midway', async () => {
    const a = createInstance();
    const value = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('partial'));
        controller.error(new Error('render failed'));
      },
    });
    await a.handler.set(KEY, Promise.resolve({ ...makeEntry(''), value }));

    expect(await a.handler.get(KEY, [])).toBeUndefined();
    expect(store.data.size).toBe(0);
  });

  it('makes a get wait for a pending set of the same key', async () => {
    const a = createInstance();
    let resolveEntry: (entry: CacheEntry) => void = () => {};
    const setting = a.handler.set(
      KEY,
      new Promise<CacheEntry>((resolve) => {
        resolveEntry = resolve;
      }),
    );
    const getting = a.handler.get(KEY, []);
    resolveEntry(makeEntry('late'));

    expect(await readText(await getting)).toBe('late');
    await setting;
  });

  describe('tags', () => {
    async function cacheOnBoth(tags: string[]) {
      const a = createInstance();
      const b = createInstance();
      await a.handler.set(KEY, Promise.resolve(makeEntry('v1', { tags })));
      // B has it in its local tier too, like a warm instance.
      await b.handler.get(KEY, []);
      await b.handler.refreshTags();
      clock += 1000;
      return { a, b };
    }

    it('marks entries stale on other instances (revalidateTag max)', async () => {
      const { a, b } = await cacheOnBoth(['probe']);

      await a.handler.updateTags(['probe'], MAX);
      await b.handler.refreshTags();

      const fromB = await b.handler.get(KEY, []);
      expect(await readText(fromB)).toBe('v1');
      expect(fromB?.revalidate).toBe(-1);
      expect(await b.handler.getExpiration(['probe'])).toBe(
        clock + MAX.expire * 1000,
      );
    });

    it('drops entries on other instances when a tag expires now', async () => {
      const { a, b } = await cacheOnBoth(['probe']);

      await a.handler.updateTags(['probe']);
      await b.handler.refreshTags();

      expect(await b.handler.get(KEY, [])).toBeUndefined();
      expect(await a.handler.get(KEY, [])).toBeUndefined();
      expect(await b.handler.getExpiration(['probe', 'other'])).toBe(clock);
    });

    it('invalidates through soft tags (revalidatePath)', async () => {
      const { a, b } = await cacheOnBoth([]);
      const softTags = ['_N_T_/layout', '_N_T_/en/probe'];

      await a.handler.updateTags(['_N_T_/en/probe']);
      await b.handler.refreshTags();

      expect(await b.handler.getExpiration(softTags)).toBe(clock);
      expect(await b.handler.get(KEY, softTags)).toBeUndefined();
    });

    it('keeps entries created after the invalidation fresh', async () => {
      const { a, b } = await cacheOnBoth(['probe']);
      await a.handler.updateTags(['probe']);
      clock += 1000;

      await a.handler.set(
        KEY,
        Promise.resolve(makeEntry('v2', { tags: ['probe'] })),
      );
      await b.handler.refreshTags();

      const fromB = await b.handler.get(KEY, []);
      expect(await readText(fromB)).toBe('v2');
      expect(fromB?.revalidate).toBe(900);
    });

    it('lets a later immediate expiration replace a far-future one', async () => {
      const { a, b } = await cacheOnBoth(['probe']);
      await a.handler.updateTags(['probe'], MAX);
      await b.handler.refreshTags();
      clock += 1000;

      await a.handler.updateTags(['probe']);
      await b.handler.refreshTags();

      expect(b.tagsManifest.get('probe')?.expired).toBe(clock);
      expect(await b.handler.get(KEY, [])).toBeUndefined();
    });

    it('loads tags written before the instance started', async () => {
      const a = createInstance();
      await a.handler.updateTags(['probe']);

      const late = createInstance();
      await late.handler.refreshTags();

      expect(late.tagsManifest.get('probe')).toEqual({ expired: clock });
    });

    it('syncs cheaply: debounced, and only fetches what changed', async () => {
      const a = createInstance();
      const b = createInstance({ tagsSyncIntervalMs: 1000 });
      await b.handler.refreshTags();
      expect(b.redis.calls).toEqual(['get']);

      await a.handler.updateTags(['probe']);
      b.redis.calls.length = 0;
      await b.handler.refreshTags();
      expect(b.redis.calls).toEqual([]);

      clock += 1000;
      await b.handler.refreshTags();
      expect(b.redis.calls).toEqual(['get', 'zrangebyscore', 'hmget', 'hmget']);
      expect(b.tagsManifest.get('probe')).toEqual({ expired: clock - 1000 });

      b.redis.calls.length = 0;
      clock += 1000;
      await b.handler.refreshTags();
      expect(b.redis.calls).toEqual(['get']);
    });

    it('keeps syncing after Redis restarts empty', async () => {
      const { a, b } = await cacheOnBoth(['probe']);
      await a.handler.updateTags(['other']);
      await b.handler.refreshTags();

      store.data.clear();
      clock += 1000;
      await a.handler.updateTags(['probe']);
      await b.handler.refreshTags();

      expect(b.tagsManifest.get('probe')).toEqual({ expired: clock });
    });

    it('prunes tag invalidations older than the retention', async () => {
      const a = createInstance({ retentionMs: 60_000 });
      await a.handler.updateTags(['old']);
      clock += 2 * 60 * 60 * 1000;

      await a.handler.updateTags(['new']);

      const late = createInstance();
      await late.handler.refreshTags();
      expect([...late.tagsManifest.keys()]).toEqual(['new']);
    });
  });

  describe('when Redis fails', () => {
    function failing(failWith: FakeRedisClient['failWith']) {
      const instance = createInstance({ operationTimeoutMs: 20 });
      instance.redis.failWith = failWith;
      return instance;
    }

    it('treats reads as misses and keeps a local copy of writes', async () => {
      const { handler, warn } = failing(new Error('ECONNREFUSED'));

      expect(await handler.get(KEY, [])).toBeUndefined();
      await handler.set(KEY, Promise.resolve(makeEntry('local')));
      await handler.refreshTags();

      expect(await readText(await handler.get(KEY, []))).toBe('local');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('ECONNREFUSED');
    });

    it('never hangs when Redis does not answer', async () => {
      const { handler } = failing('hang');

      expect(await handler.get(KEY, [])).toBeUndefined();
      clock += 5000;
      await handler.refreshTags();
      clock += 5000;
      await handler.set(KEY, Promise.resolve(makeEntry('local')));
      expect(await readText(await handler.get(KEY, []))).toBe('local');
    });

    it('skips Redis during the cooldown, then retries', async () => {
      const { handler, redis } = failing(new Error('down'));
      await handler.get(KEY, []);
      redis.calls.length = 0;

      await handler.get('other', []);
      expect(redis.calls).toEqual([]);

      clock += 1000;
      await handler.get('other', []);
      expect(redis.calls).toEqual(['getBuffer']);
    });

    it('throttles warnings', async () => {
      const { handler, warn } = failing(new Error('down'));
      for (let i = 0; i < 5; i += 1) {
        await handler.get(KEY, []);
        clock += 1000;
      }
      expect(warn).toHaveBeenCalledTimes(1);

      clock += 30_000;
      await handler.get(KEY, []);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[1]?.[0]).toContain(
        '4 similar warnings suppressed',
      );
    });

    it('applies a tag update locally but reports it was not shared', async () => {
      const { handler, tagsManifest, logError } = failing(new Error('down'));

      await handler.updateTags(['probe']);
      await handler.updateTags(['other']);

      expect(tagsManifest.get('probe')).toEqual({ expired: clock });
      // Every lost invalidation is reported, not throttled like warnings.
      expect(logError).toHaveBeenCalledTimes(2);
      expect(logError.mock.calls[0]?.[0]).toContain('this instance only');
    });
  });
});

describe('createCacheHandlerFromEnv', () => {
  const redisEnv = { CACHE_REDIS_URL: 'redis://localhost:6380' };

  function create(env: Record<string, string | undefined>, buildId?: string) {
    const createRedisClient = vi.fn(() => createFakeRedisClient(store));
    const handler = createCacheHandlerFromEnv(env, {
      readBuildId: () => buildId,
      createRedisClient,
    });
    return { handler, createRedisClient };
  }

  it("uses Next's in-memory handler when CACHE_REDIS_URL is unset", async () => {
    const { handler, createRedisClient } = create({}, 'build-1');
    clock = Date.now();
    await handler.set(KEY, Promise.resolve(makeEntry('memory')));

    expect(await readText(await handler.get(KEY, []))).toBe('memory');
    expect(createRedisClient).not.toHaveBeenCalled();
  });

  it('treats an empty CACHE_REDIS_URL as unset', () => {
    const { createRedisClient } = create({ CACHE_REDIS_URL: '' }, 'build-1');
    expect(createRedisClient).not.toHaveBeenCalled();
  });

  it('never uses Redis during next build', () => {
    const { createRedisClient } = create(
      { ...redisEnv, NEXT_PHASE: 'phase-production-build' },
      'build-1',
    );
    expect(createRedisClient).not.toHaveBeenCalled();
  });

  it('uses Redis at runtime when CACHE_REDIS_URL is set', async () => {
    const { handler, createRedisClient } = create(redisEnv, 'build-1');
    // This handler runs on the real clock.
    clock = Date.now();
    await handler.set(KEY, Promise.resolve(makeEntry('shared')));

    expect(createRedisClient).toHaveBeenCalledWith('redis://localhost:6380');
    expect([...store.data.keys()][0]).toMatch(
      /^notefinder:web-cache:v1:build-1:entry:/,
    );
  });

  it('falls back to memory when the build ID is unknown', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { createRedisClient } = create(redisEnv, undefined);

    expect(createRedisClient).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('rejects a malformed CACHE_REDIS_URL', () => {
    expect(() => create({ CACHE_REDIS_URL: 'http://nope' })).toThrow(
      'CACHE_REDIS_URL',
    );
  });
});
