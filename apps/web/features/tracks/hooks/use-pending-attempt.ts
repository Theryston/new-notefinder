'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { listPendingAttempts } from '../pending-attempt';
import { submitPendingAttempt } from '../submit-pending-attempt';
import { sessionStorageOrUndefined } from '../track-view-session';

/**
 * Submits every run a visitor left waiting once they sign in (the result
 * sheet sent them to sign in with a redirect back, which does not always
 * land on the Track the run was sung on). Fires once per signed-in visit; a
 * run whose submit may still succeed stays waiting for the next one. The
 * submit itself is pure ({@link submitPendingAttempt}); this is the wiring.
 */
export function usePendingAttempts(signedIn: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!signedIn) return;
    const storage = sessionStorageOrUndefined();
    void (async () => {
      for (const pending of listPendingAttempts(storage)) {
        await submitPendingAttempt({ queryClient, storage, pending }).catch(
          () => {
            // Kept waiting: the next signed-in visit tries again.
          },
        );
      }
    })();
  }, [signedIn, queryClient]);
}
