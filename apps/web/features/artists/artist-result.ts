import type { Artist } from '@notefinder/contracts';

import { isApiError } from '@/lib/api/api-error';
import { classifyArtistResponse } from '@/lib/artist-route';

/**
 * What the cached artist fetcher answers. Plain data only: errors thrown
 * from a `'use cache'` function cross a serialization boundary that hides
 * their shape from the route, so the legacy redirect and the 404 travel as
 * data and the proxy (with this page as its fallback) turns them into a
 * 308 and a real 404.
 */
export type ArtistResult =
  /** The header detail. */
  | { status: 'found'; artist: Artist }
  /** A legacy ID: redirect permanently to the new ID, keeping the query. */
  | { status: 'moved'; newId: string }
  /** An unknown ID: a real 404. */
  | { status: 'missing' };

export const artistFound = (artist: Artist): ArtistResult => ({
  status: 'found',
  artist,
});

/**
 * Maps a fetch failure to its `ArtistResult`, or undefined when it is not
 * a domain outcome (a 500, a network error, a malformed envelope): those
 * still throw, so they surface as errors instead of wrong pages. Uses the
 * same classifier as the proxy, so both agree on every outcome.
 */
export function artistResultFromError(
  error: unknown,
): ArtistResult | undefined {
  if (!isApiError(error)) return undefined;
  const verdict = classifyArtistResponse(error.statusCode, {
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
