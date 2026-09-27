import { z } from 'zod';

import { parseEnv } from './parse-env';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
});

export type ClientEnv = z.output<typeof clientEnvSchema>;

let cached: ClientEnv | undefined;

/**
 * Only `NEXT_PUBLIC_*` values, safe to ship to the browser. Next inlines them
 * at build time, so each one must be referenced literally below.
 */
export function getClientEnv(): ClientEnv {
  cached ??= parseEnv('public', clientEnvSchema, {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });
  return cached;
}
