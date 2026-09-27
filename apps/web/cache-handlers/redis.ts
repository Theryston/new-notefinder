import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Redis } from 'ioredis';
import { createDefaultCacheHandler } from 'next/dist/server/lib/cache-handlers/default.js';
import type { CacheHandler } from 'next/dist/server/lib/cache-handlers/types';
import { tagsManifest } from 'next/dist/server/lib/incremental-cache/tags-manifest.external.js';
import { z } from 'zod';

import { parseEnv } from '../lib/env/parse-env.ts';
import {
  type CacheRedisClient,
  createRedisCacheHandler,
} from './redis-cache-handler.ts';

/*
 * Next loads this file itself with a native `import()` at runtime (it is not
 * part of the app bundle), so it runs under Node's TypeScript type stripping:
 * relative imports carry their `.ts` extension, and `lib/env/server.ts` can't
 * be used (`server-only` throws outside the React Server bundle). The env
 * var is therefore validated here as well; `lib/env/server.ts` validates the
 * same value when the server starts.
 */

// Next's own default: `cacheMaxMemorySize` (50 MB) for the built-in handler.
const IN_MEMORY_MAX_BYTES = 50 * 1024 * 1024;
// Bump when the stored entry format changes.
const KEY_PREFIX = 'notefinder:web-cache:v1';

const cacheEnvSchema = z.object({
  CACHE_REDIS_URL: z
    .url({ protocol: /^rediss?$/ })
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type CacheHandlerEnv = Record<string, string | undefined>;

function readBuildId(): string | undefined {
  try {
    // Next's default distDir, next to this folder. The ignore comment keeps
    // Turbopack's file tracing from resolving it as a module at build time.
    const file = join(
      /* turbopackIgnore: true */ dirname(fileURLToPath(import.meta.url)),
      '../.next/BUILD_ID',
    );
    return readFileSync(file, 'utf8').trim();
  } catch {
    return undefined;
  }
}

function createRedisClient(url: string): CacheRedisClient {
  const client = new Redis(url, {
    // Connect in the background: requests never wait for it.
    lazyConnect: true,
    // While disconnected, commands fail at once (the handler falls back to
    // its local tier) instead of piling up until Redis comes back.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 1000,
    // Keep reconnecting forever, backing off up to 5s between attempts.
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  });
  // Without a listener ioredis reports every failed reconnect as an unhandled
  // error; failures surface (throttled) through the handler's warnings.
  client.on('error', () => {});
  client.connect().catch(() => {});
  return client;
}

/**
 * Picks the handler for this process: Redis-backed when `CACHE_REDIS_URL` is
 * set at runtime, otherwise exactly Next's default in-memory handler (local
 * dev without Redis, CI, and always during `next build`, so a build never
 * needs Redis nor fills it with entries of a build that may never ship).
 */
export function createCacheHandlerFromEnv(
  env: CacheHandlerEnv,
  deps: {
    readBuildId?: () => string | undefined;
    createRedisClient?: (url: string) => CacheRedisClient;
  } = {},
): CacheHandler {
  const { CACHE_REDIS_URL } = parseEnv('cache handler', cacheEnvSchema, {
    CACHE_REDIS_URL: env.CACHE_REDIS_URL,
  });
  const inMemory = () => createDefaultCacheHandler(IN_MEMORY_MAX_BYTES);

  if (!CACHE_REDIS_URL || env.NEXT_PHASE === 'phase-production-build') {
    return inMemory();
  }

  const isDevServer = Boolean(env.__NEXT_DEV_SERVER);
  // `next dev` has no build ID; its entries get their own namespace.
  const buildId = isDevServer
    ? 'development'
    : (deps.readBuildId ?? readBuildId)();
  if (!buildId) {
    console.warn(
      '[cache] CACHE_REDIS_URL is set but the build ID could not be read; ' +
        'using the in-process cache only.',
    );
    return inMemory();
  }

  return createRedisCacheHandler({
    redis: (deps.createRedisClient ?? createRedisClient)(CACHE_REDIS_URL),
    keyPrefix: KEY_PREFIX,
    buildId,
    tagsManifest,
    isDevServer,
  });
}

// Next requires the handler as the module's default export. One instance
// serves both `default` and `remote` (see next.config.ts).
const cacheHandler = createCacheHandlerFromEnv(process.env);
export default cacheHandler;
