import {
  classifyEntityResponse,
  type EntityCheckFetch,
  type EntityRouteVerdict,
  entityRedirectUrl,
  fetchEntityRouteVerdict,
  parseEntityRoute,
} from './entity-route';
import type { Locale } from './i18n/routing';

/**
 * Artist-route verdicts for `proxy.ts`: the shared entity rules from
 * `entity-route.ts`, bound to the `artists` collection.
 */

export type ArtistRoute = { locale: Locale; artistId: string } | undefined;

/**
 * `/<locale>/artists/<id>` with a single non-empty ID segment, or undefined
 * for anything else.
 */
export function parseArtistRoute(pathname: string): ArtistRoute {
  const route = parseEntityRoute(pathname);
  if (route?.collection !== 'artists') return undefined;
  return { locale: route.locale, artistId: route.id };
}

/** Same URL with the artist ID swapped for the new one, query kept. */
export const artistRedirectUrl = entityRedirectUrl;

export type ArtistRouteVerdict = EntityRouteVerdict;

/** What the proxy answers an artist API check with (see `entity-route.ts`). */
export const classifyArtistResponse = classifyEntityResponse;

export type ArtistCheckFetch = EntityCheckFetch;

/** Asks the API for the artist and classifies the answer for the proxy. */
export function fetchArtistRouteVerdict(
  apiUrl: string,
  artistId: string,
  fetchFn?: ArtistCheckFetch,
): Promise<ArtistRouteVerdict> {
  return fetchEntityRouteVerdict(apiUrl, 'artists', artistId, fetchFn);
}
