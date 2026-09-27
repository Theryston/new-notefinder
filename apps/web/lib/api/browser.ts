import type { z } from 'zod';

import { getClientEnv } from '@/lib/env/client';

import { type ApiRequestOptions, apiRequest } from './request';

/**
 * Browser API client (`NEXT_PUBLIC_API_URL`), used by TanStack Query hooks.
 * Sends the session cookie cross-origin.
 */
export function browserApi<TSchema extends z.ZodType>(
  path: `/${string}`,
  options: ApiRequestOptions<TSchema>,
): Promise<z.output<TSchema>> {
  return apiRequest(getClientEnv().NEXT_PUBLIC_API_URL, path, options, {
    credentials: 'include',
  });
}
