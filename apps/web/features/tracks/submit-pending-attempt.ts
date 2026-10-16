import type { QueryClient } from '@tanstack/react-query';

import { submitPracticeAttempt } from './attempt-queries';
import { clearPendingAttempt, readPendingAttempt } from './pending-attempt';
import { trackKeys } from './query-keys';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Submits the run a visitor left waiting, once they sign in. A refused run
 * is forgotten too, since it would never save. Returns whether anything was
 * waiting. Kept out of the hook so the wiring stays testable without
 * rendering.
 */
export async function submitPendingAttempt({
  trackId,
  queryClient,
  storage,
}: {
  trackId: string;
  queryClient: QueryClient;
  storage: (ReadableStorage & WritableStorage) | undefined;
}): Promise<boolean> {
  const pending = readPendingAttempt(storage, trackId);
  if (!pending) return false;
  try {
    await submitPracticeAttempt(pending.trackId, pending.body);
    clearPendingAttempt(storage, trackId);
    await queryClient.invalidateQueries({
      queryKey: trackKeys.userState(trackId),
    });
  } catch {
    clearPendingAttempt(storage, trackId);
  }
  return true;
}
