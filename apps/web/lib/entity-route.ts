import {
  apiErrorSchema,
  resourceMovedDetailsSchema,
} from '@notefinder/contracts';

import { isApiError } from '@/lib/api/api-error';

import type { Locale } from './i18n/routing';
import { isLocale } from './i18n/routing';

/**
 * Catalog-entity route rules, shared by `proxy.ts` and the artist, album and
 * track result mappers. The proxy must decide 308s and 404s before anything
 * streams: with Cache Components every dynamic route streams a static shell
 * first, so a `permanentRedirect`/`notFound` issued from the page degrades to a
 * 200 (meta refresh / in-place UI) and crawlers and legacy bookmarks never see
 * the real status. The proxy check runs before the first byte instead.
 */

const entityCollections = ['artists', 'albums'] as const;

type EntityCollection = (typeof entityCollections)[number];

type EntityRoute = {
  locale: Locale;
  collection: EntityCollection;
  id: string;
};

/** `/<locale>/tracks/<id>`: the Processing page of a Track. */
export type TrackRoute = {
  locale: Locale;
  collection: 'tracks';
  id: string;
};

/** Any catalog route the proxy checks before the page streams. */
export type CatalogRoute = EntityRoute | TrackRoute;

const isEntityCollection = (value: string): value is EntityCollection =>
  (entityCollections as readonly string[]).includes(value);

/**
 * The locale, the collection and the decoded ID of `/<locale>/<collection>/<id>`
 * with a single non-empty ID segment (an optional trailing slash changes
 * nothing), or undefined for anything else.
 */
function idRouteParts(
  pathname: string,
): { locale: string | undefined; collection: string; id: string } | undefined {
  const [, first, second, third, rest] = pathname.split('/');
  if (!second || !third) return undefined;
  if (rest !== undefined && rest !== '') return undefined;
  try {
    return {
      locale: first,
      collection: second,
      id: decodeURIComponent(third),
    };
  } catch {
    return undefined;
  }
}

/**
 * `/<locale>/<artists|albums>/<id>`, or undefined for anything else. Only called
 * for locale-prefixed paths (the proxy turns bare legacy paths into those with a
 * 307 first, uncached).
 */
export function parseEntityRoute(pathname: string): EntityRoute | undefined {
  const parts = idRouteParts(pathname);
  if (!parts || !isEntityCollection(parts.collection)) return undefined;
  if (!isLocale(parts.locale)) return undefined;
  return {
    locale: parts.locale,
    collection: parts.collection,
    id: parts.id,
  };
}

/** `/<locale>/tracks/<id>`, or undefined for anything else. */
export function parseTrackRoute(pathname: string): TrackRoute | undefined {
  const parts = idRouteParts(pathname);
  if (parts?.collection !== 'tracks') return undefined;
  if (!isLocale(parts.locale)) return undefined;
  return { locale: parts.locale, collection: 'tracks', id: parts.id };
}

/** The catalog route a path is, if it is one the proxy checks. */
export function parseCatalogRoute(pathname: string): CatalogRoute | undefined {
  return parseEntityRoute(pathname) ?? parseTrackRoute(pathname);
}

/**
 * The URL a legacy ID redirects to: the same URL with the route's ID swapped
 * for the new ID, so the locale, the collection and the query are kept.
 */
export function entityRedirectUrl(
  requestHref: string,
  route: CatalogRoute,
  newId: string,
): URL {
  const url = new URL(requestHref);
  url.pathname = `/${route.locale}/${route.collection}/${encodeURIComponent(newId)}`;
  return url;
}

type EntityRouteVerdict =
  /** A 200 or anything unexpected: let the page render (fail open). */
  | { kind: 'pass' }
  /** A legacy ID: permanent redirect to the new ID. */
  | { kind: 'moved'; newId: string }
  /** An unknown ID: a real 404. */
  | { kind: 'missing' };

/**
 * Only 404s decide anything: the page renders every other outcome, including
 * its own error UI on 500s, so outages are never masked as redirects or 404s.
 * A 404 the contract cannot parse is passed through: the page re-fetches and
 * surfaces it as an error instead of presenting an API bug as a 404.
 */
function classifyEntityResponse(
  status: number,
  body: unknown,
): EntityRouteVerdict {
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

/** How long the proxy's entity check may take before letting through. */
const ENTITY_CHECK_TIMEOUT_MS = 3000;

type EntityCheckFetch = (
  input: string,
  init?: { signal?: AbortSignal },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

/**
 * Asks the API for the route's record and classifies the answer for the proxy.
 * Never throws: anything unexpected (timeout, network error, unparsable body)
 * is a `pass`, so the page renders its own outcome instead of a wrong redirect
 * or 404. The fetch is injectable for tests.
 */
async function verdictForPath(
  apiUrl: string,
  path: string,
  fetchFn: EntityCheckFetch,
): Promise<EntityRouteVerdict> {
  let status: number;
  let body: unknown;
  try {
    const response = await fetchFn(`${apiUrl.replace(/\/+$/, '')}/v1/${path}`, {
      signal: AbortSignal.timeout(ENTITY_CHECK_TIMEOUT_MS),
    });
    status = response.status;
    body = await response.json().catch(() => undefined);
  } catch {
    return { kind: 'pass' };
  }
  return classifyEntityResponse(status, body);
}

/**
 * The verdict for a catalog route: an artist or album on its own endpoint, a
 * track on its Processing endpoint. Both answer the same 404s (`RESOURCE_MOVED`,
 * `NOT_FOUND`).
 */
export function fetchCatalogRouteVerdict(
  apiUrl: string,
  route: CatalogRoute,
  fetchFn: EntityCheckFetch = fetch,
): Promise<EntityRouteVerdict> {
  const path =
    route.collection === 'tracks'
      ? `tracks/${encodeURIComponent(route.id)}/processing`
      : `${route.collection}/${encodeURIComponent(route.id)}`;
  return verdictForPath(apiUrl, path, fetchFn);
}

/**
 * Maps a failed fetch of an entity to the outcome the page acts on: the new
 * ID of a legacy ID, or a real 404. Undefined when the failure is not a domain
 * outcome (a 500, a network error, a malformed envelope), so those still throw
 * and surface as errors instead of wrong pages. Uses the proxy's classifier,
 * so both agree on every outcome.
 */
export function entityOutcomeFromError(
  error: unknown,
): { status: 'moved'; newId: string } | { status: 'missing' } | undefined {
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
