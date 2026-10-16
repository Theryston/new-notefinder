'use client';

import { usePendingAttempt } from '../hooks/use-pending-attempt';

/**
 * Submits the run a visitor left waiting once they sign in. Renders nothing;
 * the signed-in state arrives as a prop because the session lives above.
 */
export function PendingAttemptSubmitter({
  trackId,
  signedIn,
}: {
  trackId: string;
  signedIn: boolean;
}) {
  usePendingAttempt(trackId, signedIn);
  return null;
}
