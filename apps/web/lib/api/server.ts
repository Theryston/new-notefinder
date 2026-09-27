import 'server-only';
import { headers } from 'next/headers';
import type { z } from 'zod';

import { getServerEnv } from '@/lib/env/server';

import { type ApiRequestOptions, apiRequest } from './request';

type ServerApiOptions<TSchema extends z.ZodType> =
  ApiRequestOptions<TSchema> & {
    /**
     * Forward the incoming request's `cookie` header (session). Reads the
     * request, so only use it in a request scope or `'use cache: private'`,
     * never inside a shared `'use cache'`.
     */
    forwardCookies?: boolean;
  };

/**
 * Server-side API client (`API_URL`). Public data fetchers call it from
 * `'use cache'` functions; the directive caches the result, not `fetch`.
 */
export async function serverApi<TSchema extends z.ZodType>(
  path: `/${string}`,
  { forwardCookies = false, ...options }: ServerApiOptions<TSchema>,
): Promise<z.output<TSchema>> {
  const requestHeaders = new Headers(options.headers);

  if (forwardCookies) {
    const cookie = (await headers()).get('cookie');
    if (cookie) requestHeaders.set('cookie', cookie);
  }

  return apiRequest(getServerEnv().API_URL, path, {
    ...options,
    headers: requestHeaders,
  });
}
