import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { CacheService } from './cache.service.js';
import { REDIS_CLIENT } from './redis.constants.js';

const trackSchema = z.object({ id: z.string(), title: z.string() });

describe('CacheService', () => {
  let cache: CacheService;
  const redis = {
    get: vi.fn(),
    set: vi.fn(),
    unlink: vi.fn(),
    scan: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [CacheService, { provide: REDIS_CLIENT, useValue: redis }],
    }).compile();
    cache = moduleRef.get(CacheService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('parses a hit with the schema under the namespaced key', async () => {
      redis.get.mockResolvedValue('{"id":"t1","title":"Song","extra":1}');
      await expect(cache.get('tracks:t1', trackSchema)).resolves.toEqual({
        id: 't1',
        title: 'Song',
      });
      expect(redis.get).toHaveBeenCalledWith('notefinder:cache:tracks:t1');
    });

    it('returns undefined on a miss', async () => {
      redis.get.mockResolvedValue(null);
      await expect(cache.get('tracks:t1', trackSchema)).resolves.toBe(
        undefined,
      );
    });

    it('drops values that no longer match the schema', async () => {
      redis.get.mockResolvedValue('{"id":"t1"}');
      await expect(cache.get('tracks:t1', trackSchema)).resolves.toBe(
        undefined,
      );
      expect(redis.unlink).toHaveBeenCalledWith('notefinder:cache:tracks:t1');
    });

    it('drops values that are not valid JSON', async () => {
      redis.get.mockResolvedValue('{not json');
      await expect(cache.get('tracks:t1', trackSchema)).resolves.toBe(
        undefined,
      );
      expect(redis.unlink).toHaveBeenCalled();
    });

    it('treats Redis errors as a miss', async () => {
      redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(cache.get('tracks:t1', trackSchema)).resolves.toBe(
        undefined,
      );
    });
  });

  describe('set', () => {
    it('stores JSON with a TTL in seconds', async () => {
      await cache.set('tracks:t1', { id: 't1', title: 'Song' }, 60);
      expect(redis.set).toHaveBeenCalledWith(
        'notefinder:cache:tracks:t1',
        '{"id":"t1","title":"Song"}',
        'EX',
        60,
      );
    });

    it('rejects invalid TTLs', async () => {
      await expect(cache.set('k', 1, 0)).rejects.toThrow(RangeError);
      await expect(cache.set('k', 1, 1.5)).rejects.toThrow(RangeError);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('rejects values that JSON cannot represent', async () => {
      await expect(cache.set('k', undefined, 60)).rejects.toThrow(TypeError);
    });

    it('swallows Redis errors', async () => {
      redis.set.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(cache.set('k', 1, 60)).resolves.toBeUndefined();
    });
  });

  describe('wrap', () => {
    it('returns the cached value without calling fn', async () => {
      redis.get.mockResolvedValue('{"id":"t1","title":"Song"}');
      const fn = vi.fn();
      await expect(
        cache.wrap('tracks:t1', 60, trackSchema, fn),
      ).resolves.toEqual({ id: 't1', title: 'Song' });
      expect(fn).not.toHaveBeenCalled();
    });

    it('computes and stores the value on a miss', async () => {
      redis.get.mockResolvedValue(null);
      const value = { id: 't1', title: 'Song' };
      await expect(
        cache.wrap('tracks:t1', 60, trackSchema, async () => value),
      ).resolves.toBe(value);
      expect(redis.set).toHaveBeenCalledWith(
        'notefinder:cache:tracks:t1',
        JSON.stringify(value),
        'EX',
        60,
      );
    });

    it('still returns the computed value when Redis is down', async () => {
      redis.get.mockRejectedValue(new Error('down'));
      redis.set.mockRejectedValue(new Error('down'));
      await expect(
        cache.wrap('k', 60, z.number(), async () => 42),
      ).resolves.toBe(42);
    });
  });

  describe('del', () => {
    it('unlinks a single key', async () => {
      await cache.del('tracks:t1');
      expect(redis.unlink).toHaveBeenCalledWith('notefinder:cache:tracks:t1');
      expect(redis.scan).not.toHaveBeenCalled();
    });

    it('scans and unlinks every key matching a pattern', async () => {
      redis.scan
        .mockResolvedValueOnce(['7', ['notefinder:cache:tracks:a']])
        .mockResolvedValueOnce(['0', []]);
      await cache.del('tracks:*');
      expect(redis.scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        'notefinder:cache:tracks:*',
        'COUNT',
        500,
      );
      expect(redis.scan).toHaveBeenNthCalledWith(
        2,
        '7',
        'MATCH',
        'notefinder:cache:tracks:*',
        'COUNT',
        500,
      );
      expect(redis.unlink).toHaveBeenCalledTimes(1);
      expect(redis.unlink).toHaveBeenCalledWith('notefinder:cache:tracks:a');
    });

    it('matches glob characters other than * literally', async () => {
      redis.scan.mockResolvedValue(['0', []]);
      await cache.del('users:a?b[c]:*');
      expect(redis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'notefinder:cache:users:a\\?b\\[c\\]:*',
        'COUNT',
        500,
      );
    });

    it('swallows Redis errors', async () => {
      redis.unlink.mockRejectedValue(new Error('down'));
      await expect(cache.del('k')).resolves.toBeUndefined();
    });
  });
});
