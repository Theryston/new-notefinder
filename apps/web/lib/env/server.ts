import 'server-only';
import { z } from 'zod';

import { parseEnv } from './parse-env';

const serverEnvSchema = z.object({
  API_URL: z.url(),
  REVALIDATE_SECRET: z.string().min(32),
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
  });
  return cached;
}
