import type { Album } from '@notefinder/contracts';

import { isApiError } from '@/lib/api/api-error';
import { classifyEntityResponse } from '@/lib/entity-route';

/**
 * What the cached album fetcher answers. Plain data only: errors thrown
 * from a `'use cache'` function cross a serialization boundary that hides
 * their shape from the route, so the legacy redirect and the 404 travel as
 * data and the proxy (with this page as its fallback) turns them into a
 * 308 and a real 404.
 */
export type AlbumResult =
  /** The header detail. */
  | { status: 'found'; album: Album }
  /** A legacy ID: redirect permanently to the new ID, keeping the query. */
  | { status: 'moved'; newId: string }
  /** An unknown ID: a real 404. */
  | { status: 'missing' };

export const albumFound = (album: Album): AlbumResult => ({
  status: 'found',
  album,
});

/**
 * Maps a fetch failure to its `AlbumResult`, or undefined when it is not a
 * domain outcome (a 500, a network error, a malformed envelope): those still
 * throw, so they surface as errors instead of wrong pages. Uses the same
 * classifier as the proxy, so both agree on every outcome.
 */
export function albumResultFromError(error: unknown): AlbumResult | undefined {
  if (!isApiError(error)) return undefined;
  const verdict = classifyEntityResponse(error.statusCode, {
    statusCode: error.statusCode,
    code: error.code,
    message: error.message,
    details: error.details,
  });
  if (verdict.kind === 'moved') {
    return { status: 'moved', newId: verdict.newId };
  }
  if (verdict.kind === 'missing') {
    return { status: 'missing' };
  }
  return undefined;
}
