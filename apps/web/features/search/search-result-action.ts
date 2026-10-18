/** Who is looking at the hits: `null` when signed out. */
export type ResultViewer = { username: string | null } | null;

/**
 * What a click on a hit does, for the search card and the header suggestion
 * alike: a Track link, a request for the notes, a sign-in first (then the
 * request), or nothing but the static card.
 */
export type ResultAction = 'link' | 'request' | 'sign-in' | 'static';

/**
 * The action of one hit for one viewer. The search card and the header rows
 * both branch on it, so the two surfaces decide the same way.
 */
export function resultAction(
  result: { trackId: string | null },
  user: ResultViewer,
): ResultAction {
  if (result.trackId !== null) return 'link';
  if (offersTrackRequest(result, user)) return 'request';
  if (offersSignInToRequest(result, user)) return 'sign-in';
  return 'static';
}

/**
 * Whether a search hit offers "generate notes": it has no Track yet, and the
 * visitor is signed in with a username (the API refuses a request without
 * one). Everyone else sees a static card, as before.
 */
export function offersTrackRequest(
  result: { trackId: string | null },
  user: ResultViewer,
): boolean {
  return result.trackId === null && user !== null && user.username !== null;
}

/**
 * Whether a click on a hit asks a signed-out visitor to sign in first: a
 * Recording with no Track, for a visitor who is signed out. The sign-in comes
 * back to the search with the request marker, which asks for the Track then
 * (see `signInToRequestHref`).
 */
export function offersSignInToRequest(
  result: { trackId: string | null },
  user: ResultViewer,
): boolean {
  return result.trackId === null && user === null;
}
