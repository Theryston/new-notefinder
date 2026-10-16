import type { QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/lib/api/api-error';

import { submitPracticeAttempt } from './attempt-queries';
import {
  clearPendingAttempt,
  type PendingAttempt,
  type PendingAttemptStorage,
} from './pending-attempt';
import { invalidateTrackState } from './track-user-state-query';

/**
 * Whether a failed submit is worth retrying: the network may be back, the
 * server may recover, and a rate limit passes. Anything else (a run the API
 * refused, a Track that is gone) would never save, so it is forgotten.
 */
function shouldRetry(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return error.statusCode >= 500 || error.statusCode === 429;
}

/**
 * Submits one run a visitor left waiting. A submitted run is forgotten and
 * the Track state is read again; a refused run is forgotten too, since it
 * would never save. A run whose submit may still succeed stays waiting for
 * the next signed-in visit. Kept out of the hook so the wiring stays
 * testable without rendering.
 */
export async function submitPendingAttempt({
  queryClient,
  storage,
  pending,
}: {
  queryClient: QueryClient;
  storage: PendingAttemptStorage | undefined;
  pending: PendingAttempt;
}): Promise<void> {
  try {
    await submitPracticeAttempt(pending.trackId, pending.body);
    clearPendingAttempt(storage, pending.trackId);
    await invalidateTrackState(queryClient, pending.trackId);
  } catch (error) {
    if (!shouldRetry(error)) {
      clearPendingAttempt(storage, pending.trackId);
    }
    throw error;
  }
}
