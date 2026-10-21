import type { TestingModuleBuilder } from '@nestjs/testing';
import type { z } from 'zod';
import { CacheService } from '../../src/redis/cache.service.js';

/**
 * An in-memory stand-in for the shared cache, with the lock's NX semantics. The
 * e2e Redis is a stub that drops writes, so a feed that a cursor must find again
 * (its version) needs this to persist across requests.
 */
class InMemoryCache {
  private readonly values = new Map<string, unknown>();
  private readonly locks = new Set<string>();

  async get<T>(key: string, schema: z.ZodType<T>): Promise<T | undefined> {
    const parsed = schema.safeParse(this.values.get(key));
    return parsed.success ? parsed.data : undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  async acquire(key: string): Promise<boolean> {
    if (this.locks.has(key)) {
      return false;
    }
    this.locks.add(key);
    return true;
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
    this.locks.delete(key);
  }

  /** Forgets every entry: a spec calls it before each test. */
  clear(): void {
    this.values.clear();
    this.locks.clear();
  }
}

/** The one cache the app under test uses, so a spec can clear it. */
export const sharedInMemoryCache = new InMemoryCache();

/** Replaces the Redis-backed cache with an in-memory one for the app under test. */
export const withInMemoryCache = (builder: TestingModuleBuilder) =>
  builder.overrideProvider(CacheService).useValue(sharedInMemoryCache);
