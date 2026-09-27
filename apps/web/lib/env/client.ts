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

export const DEFAULT_SITE_URL = 'http://localhost:3000';

const siteUrlSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .url()
    .default(DEFAULT_SITE_URL)
    .transform((url) => new URL(url)),
});

let cachedSiteUrl: URL | undefined;

/**
 * Public origin of the site (e.g. `https://notefinder.com.br`), used as
 * `metadataBase` so canonical and hreflang URLs are absolute. Separate from
 * `getClientEnv()` because metadata is rendered during `next build`, where
 * the other public values may be missing. Static pages bake it in at build
 * time, so production images must be built with it (a build without it logs
 * a warning, see next.config.ts).
 */
export function getSiteUrl(): URL {
  cachedSiteUrl ??= parseEnv('public', siteUrlSchema, {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  }).NEXT_PUBLIC_SITE_URL;
  return cachedSiteUrl;
}
