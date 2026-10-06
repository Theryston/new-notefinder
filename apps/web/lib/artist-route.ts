import {
  apiErrorSchema,
  resourceMovedDetailsSchema,
} from '@notefinder/contracts';

import type { Locale } from './i18n/routing';
import { isLocale } from './i18n/routing';

/**
 * Artist-route verdicts for `proxy.ts`, which must decide 308s and 404s
 * before anything streams: with Cache Components every dynamic route
 * streams a static shell first, so a `permanentRedirect`/`notFound` issued
 * from the page degrades to a 200 (meta refresh / in-place UI) and crawlers
 * and legacy bookmarks never see the real status. The proxy check runs
 * before the first byte instead.
 */

export type ArtistRoute = { locale: Locale; artistId: string } | undefined;

/**
 * `/<locale>/artists/<id>` with a single non-empty ID segment, or undefined
 * for anything else. Only called for locale-prefixed paths (the proxy turns
 * bare legacy paths into those with a 307 first, uncached).
 */
export function parseArtistRoute(pathname: string): ArtistRoute {
  const [, first, second, third, rest] = pathname.split('/');
  if (second !== 'artists' || !third) return undefined;
  // A single ID segment (an optional trailing slash changes nothing).
  if (rest !== undefined && rest !== '') return undefined;
  if (!isLocale(first)) return undefined;
  let artistId: string;
  try {
    artistId = decodeURIComponent(third);
  } catch {
    return undefined;
  }
  // Decoding never empties a non-empty segment, and `!third` ruled out the
  // empty one above.
  return { locale: first, artistId };
}

/** Same URL with the artist ID swapped for the new one, query kept. */
export function artistRedirectUrl(requestUrl: URL, newId: string): URL {
  const url = new URL(requestUrl);
  const segments = url.pathname.split('/');
  segments[segments.length - 1] = encodeURIComponent(newId);
  url.pathname = segments.join('/');
  return url;
}

export type ArtistRouteVerdict =
  /** A 200 or anything unexpected: let the page render (fail open). */
  | { kind: 'pass' }
  /** A legacy ID: permanent redirect to the new ID. */
  | { kind: 'moved'; newId: string }
  /** An unknown ID: a real 404. */
  | { kind: 'missing' };

/**
 * What the proxy answers an artist API check with. Only 404s decide
 * anything (the page renders every other outcome, including its own error
 * UI on 500s, so outages are never masked as redirects or 404s). A 404
 * the contract cannot parse is passed through: the page re-fetches and
 * surfaces it as an error instead of presenting an API bug as a 404.
 */
export function classifyArtistResponse(
  status: number,
  body: unknown,
): ArtistRouteVerdict {
  if (status !== 404) return { kind: 'pass' };
  const error = apiErrorSchema.safeParse(body);
  if (!error.success) return { kind: 'pass' };
  if (error.data.code === 'RESOURCE_MOVED') {
    const details = resourceMovedDetailsSchema.safeParse(error.data.details);
    if (!details.success) return { kind: 'pass' };
    return { kind: 'moved', newId: details.data.id };
  }
  return { kind: 'missing' };
}

/** How long the proxy's artist check may take before letting through. */
const ARTIST_CHECK_TIMEOUT_MS = 3000;

export type ArtistCheckFetch = (
  input: string,
  init?: { signal?: AbortSignal },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

/**
 * Asks the API for the artist and classifies the answer for the proxy.
 * Never throws: anything unexpected (timeout, network error, unparsable
 * body) is a `pass`, so the page renders its own outcome instead of a
 * wrong redirect or 404. The fetch is injectable for tests.
 */
export async function fetchArtistRouteVerdict(
  apiUrl: string,
  artistId: string,
  fetchFn: ArtistCheckFetch = fetch,
): Promise<ArtistRouteVerdict> {
  let status: number;
  let body: unknown;
  try {
    const response = await fetchFn(
      `${apiUrl.replace(/\/+$/, '')}/v1/artists/${encodeURIComponent(artistId)}`,
      { signal: AbortSignal.timeout(ARTIST_CHECK_TIMEOUT_MS) },
    );
    status = response.status;
    body = await response.json().catch(() => undefined);
  } catch {
    return { kind: 'pass' };
  }
  return classifyArtistResponse(status, body);
}
