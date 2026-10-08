/**
 * The Recording a search page should request the Track of right now, when the
 * visitor has just come back from signing in with the request marker in its
 * URL. Only a signed-in User with a username can request (the API refuses the
 * rest), and each marker is requested once: `requested` is the one this page
 * already asked for, so a re-render or a Strict Mode replay doesn't ask twice.
 */
export function recordingToRequestOnArrival(input: {
  marker: string | null;
  signedIn: { username: string | null } | null;
  requested: string | null;
}): string | null {
  const { marker, signedIn, requested } = input;
  if (marker === null || marker === requested) return null;
  if (signedIn === null || signedIn.username === null) return null;
  return marker;
}
