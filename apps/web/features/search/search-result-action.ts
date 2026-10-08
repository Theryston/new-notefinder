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
