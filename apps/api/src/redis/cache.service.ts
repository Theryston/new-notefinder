import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { z } from 'zod';
import { REDIS_CLIENT, redisKey } from './redis.constants.js';

const SCAN_BATCH_SIZE = 500;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Everything but `*` is matched literally, so IDs inside a pattern can't
// accidentally act as glob syntax.
const escapeGlob = (pattern: string): string =>
  pattern.replace(/[?[\]\\]/g, '\\$&');

const cacheKey = (key: string): string => redisKey('cache', key);

/**
 * JSON cache on Redis. Keys are relative to `notefinder:cache:` and start with
 * the owning feature (`tracks:<id>`), so `del('tracks:*')` flushes one feature
 * without touching queues or rate-limit counters.
 *
 * Reads and writes fail open: Redis errors are logged and treated as a miss,
 * so an outage makes reads slower, never broken. Values are validated on
 * read, so a shape change between deploys just becomes a miss. Use schemas
 * without transforms, since they parse the JSON of their own output.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string, schema: z.ZodType<T>): Promise<T | undefined> {
    let raw: string | null;
    try {
      raw = await this.redis.get(cacheKey(key));
    } catch (error) {
      this.logger.warn(`Read failed for ${key}: ${errorMessage(error)}`);
      return undefined;
    }
    if (raw === null) {
      return undefined;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      json = undefined;
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      this.logger.warn(`Discarding cached value with a stale shape: ${key}`);
      await this.del(key);
      return undefined;
    }
    return parsed.data;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError(`ttlSeconds must be a positive integer (${key})`);
    }
    const serialized: string | undefined = JSON.stringify(value);
    if (serialized === undefined) {
      throw new TypeError(`Value is not JSON-serializable (${key})`);
    }
    try {
      await this.redis.set(cacheKey(key), serialized, 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Write failed for ${key}: ${errorMessage(error)}`);
    }
  }

  /** Returns the cached value, or computes it with `fn` and caches it. */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    schema: z.ZodType<T>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get(key, schema);
    if (cached !== undefined) {
      return cached;
    }
    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Deletes one key, or every key matching a pattern when it contains `*`
   * (`tracks:abc:*`). Patterns are resolved with SCAN, never KEYS, so a large
   * keyspace doesn't block Redis.
   */
  async del(keyOrPattern: string): Promise<void> {
    try {
      if (!keyOrPattern.includes('*')) {
        await this.redis.unlink(cacheKey(keyOrPattern));
        return;
      }
      const match = cacheKey(escapeGlob(keyOrPattern));
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          match,
          'COUNT',
          SCAN_BATCH_SIZE,
        );
        if (keys.length > 0) {
          await this.redis.unlink(...keys);
        }
        cursor = nextCursor;
      } while (cursor !== '0');
    } catch (error) {
      // Logged as an error: a failed invalidation serves stale data until
      // the key's TTL runs out.
      this.logger.error(
        `Delete failed for ${keyOrPattern}: ${errorMessage(error)}`,
      );
    }
  }
}
