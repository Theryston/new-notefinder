/** Why the mic could not be turned on, in terms the user can act on. */
export type MicProblem = 'denied' | 'unavailable';

/**
 * A permission refusal (the user said no, or a policy blocks the mic) is
 * fixable in the browser's settings; everything else (no device, no
 * `getUserMedia`, a device in use) is not something the user can allow.
 */
export function micProblemOf(error: unknown): MicProblem {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String(error.name)
      : '';
  return name === 'NotAllowedError' || name === 'SecurityError'
    ? 'denied'
    : 'unavailable';
}
