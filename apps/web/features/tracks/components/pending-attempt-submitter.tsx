'use client';

import { usePendingAttempts } from '../hooks/use-pending-attempt';

/**
 * Submits the runs a visitor left waiting once they sign in. Renders
 * nothing; the signed-in state arrives as a prop because the session lives
 * above.
 */
export function PendingAttemptSubmitter({ signedIn }: { signedIn: boolean }) {
  usePendingAttempts(signedIn);
  return null;
}
