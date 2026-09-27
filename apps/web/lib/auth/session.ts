import 'server-only';
import { type CurrentUser, currentUserSchema } from '@notefinder/contracts';
import { cache } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { serverApi } from '@/lib/api/server';

/**
 * The signed-in user for the current request, or `null` when signed out.
 * Forwards the request's cookies to `GET /v1/me`, so it reads the request:
 * call it inside `<Suspense>`, never in a shared `'use cache'`. Deduplicated
 * per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    return await serverApi('/me', {
      schema: currentUserSchema,
      forwardCookies: true,
    });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) return null;
    throw error;
  }
});
