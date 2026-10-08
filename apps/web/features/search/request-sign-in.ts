/** The search URL parameter that asks for a Track once the visitor is signed in. */
export const PROCESS_PARAM = 'process';

// Any origin works: it only lets `URL` resolve the path and its query.
const BASE = 'http://notefinder.invalid';

/**
 * The search page's path and query, as the visitor's URL has them: `q` and
 * `scope` when they are set. The sign-in round trip returns here.
 */
export function searchPathFrom(
  query: string | null,
  scope: string | null,
): string {
  const params = new URLSearchParams();
  if (query !== null) params.set('q', query);
  if (scope !== null) params.set('scope', scope);
  const search = params.toString();
  return search ? `/search?${search}` : '/search';
}

/**
 * The same search, with the marker that asks for `recordingMbid`'s Track
 * once the visitor is signed in. A marker already there is replaced, never
 * doubled.
 */
export function searchPathWithRequest(
  searchPath: string,
  recordingMbid: string,
): string {
  const url = new URL(searchPath, BASE);
  url.searchParams.set(PROCESS_PARAM, recordingMbid);
  return `${url.pathname}${url.search}`;
}

/**
 * Where a signed-out click on a result without a Track goes: sign in, and
 * come back to this search with the request marker (`redirectTo`).
 */
export function signInToRequestHref(
  searchPath: string,
  recordingMbid: string,
): { pathname: '/sign-in'; query: Record<string, string> } {
  return {
    pathname: '/sign-in',
    query: { redirectTo: searchPathWithRequest(searchPath, recordingMbid) },
  };
}

/**
 * Whether a result's click asks the visitor to sign in first: a Recording with
 * no Track, for a visitor who is signed out. Signed-in visitors get the request
 * itself (see `offersTrackRequest`).
 */
export function offersSignInToRequest(
  result: { trackId: string | null },
  user: { username: string | null } | null,
): boolean {
  return result.trackId === null && user === null;
}
