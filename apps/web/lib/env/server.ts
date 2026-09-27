import 'server-only';
import { z } from 'zod';

import { parseEnv } from './parse-env';

const serverEnvSchema = z.object({
  API_URL: z.url(),
  REVALIDATE_SECRET: z.string().min(32),
  // Read by `cache-handlers/redis.ts` (outside the app bundle, so it parses
  // it again); listed here so a malformed value fails at server start.
  CACHE_REDIS_URL: z
    .url({ protocol: /^rediss?$/ })
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type ServerEnv = z.output<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Parsed lazily (and validated eagerly on server start by
 * `instrumentation.ts`) so `next build` doesn't need runtime secrets.
 */
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv('server', serverEnvSchema, {
    API_URL: process.env.API_URL,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    CACHE_REDIS_URL: process.env.CACHE_REDIS_URL,
  });
  return cached;
}
