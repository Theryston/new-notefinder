import { userTrackStateSchema } from '@notefinder/contracts';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { browserApi } from '@/lib/api/browser';

import { trackKeys } from './query-keys';

const trackPath = (trackId: string): `/${string}` =>
  `/${encodeURIComponent(trackId)}`;

/**
 * What the signed-in User has with a Track (`GET /v1/me/tracks/:trackId`). It
 * depends on the session, so the browser reads it (for a signed-in User only)
 * while the page itself stays cached.
 */
export function trackUserStateQueryOptions(trackId: string) {
  return queryOptions({
    queryKey: trackKeys.userState(trackId),
    queryFn: ({ signal }) =>
      browserApi(`/me/tracks${trackPath(trackId)}`, {
        schema: userTrackStateSchema,
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
