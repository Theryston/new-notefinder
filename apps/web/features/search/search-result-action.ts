/**
 * Whether a search hit offers "generate notes": it has no Track yet, and the
 * visitor is signed in with a username (the API refuses a request without
 * one). Everyone else sees a static card, as before.
 */
export function offersTrackRequest(
  result: { trackId: string | null },
  user: { username: string | null } | null,
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
  user: { username: string | null } | null,
): boolean {
  return result.trackId === null && user === null;
}
