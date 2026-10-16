import { trackPracticeStateSchema } from '@notefinder/contracts';
import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { browserApi } from '@/lib/api/browser';

import { trackKeys } from './query-keys';

const trackPath = (trackId: string): `/${string}` =>
  `/${encodeURIComponent(trackId)}`;

/**
 * What the signed-in User has with a Track (`GET /v1/me/tracks/:trackId`):
 * the favorite and the best saved score per difficulty. It depends on the
 * session, so the browser reads it (for a signed-in User only) while the
 * page itself stays cached.
 */
export function trackUserStateQueryOptions(trackId: string) {
  return queryOptions({
    queryKey: trackKeys.userState(trackId),
    queryFn: ({ signal }) =>
      browserApi(`/me/tracks${trackPath(trackId)}`, {
        schema: trackPracticeStateSchema,
        signal,
      }),
  });
}

/** Adds the Track to the User's favorites, or removes it (both idempotent). */
export function setTrackFavorite(
  trackId: string,
  favorite: boolean,
): Promise<undefined> {
  return browserApi(`/me/favorites${trackPath(trackId)}`, {
    method: favorite ? 'PUT' : 'DELETE',
    schema: z.undefined(),
  });
}

/**
 * Reads the Track state again: a saved attempt changes the best scores, so
 * the title row and the result sheet show them at once.
 */
export function invalidateTrackState(
  queryClient: QueryClient,
  trackId: string,
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: trackKeys.userState(trackId),
  });
}
