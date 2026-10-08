/**
 * What a search page does with its `process` marker, once it is there:
 * - `request`: ask for the Track, then take the marker out of the URL;
 * - `clear`: this tab already asked for it (a sign-in step brought the marker
 *   back, or the page was reloaded), so only the marker goes;
 * - `wait`: nothing yet, because there is no marker, this page already acted on
 *   it, or the visitor is not signed in with a username (the API refuses a
 *   request without one, and the username step returns here).
 */
export type ArrivalStep = 'request' | 'clear' | 'wait';

export function arrivalStep(input: {
  marker: string | null;
  signedIn: { username: string | null } | null;
  /** The marker this page already acted on: a re-run must not act twice. */
  handled: string | null;
  alreadyRequested: boolean;
}): ArrivalStep {
  const { marker, signedIn, handled, alreadyRequested } = input;
  if (marker === null || marker === handled) return 'wait';
  if (signedIn === null || signedIn.username === null) return 'wait';
  return alreadyRequested ? 'clear' : 'request';
}
