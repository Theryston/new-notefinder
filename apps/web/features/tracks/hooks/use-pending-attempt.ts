'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { submitPendingAttempt } from '../submit-pending-attempt';
import { sessionStorageOrUndefined } from '../track-view-session';

/**
 * Submits the run a visitor left waiting once they sign in (the result sheet
 * sent them to sign in with a redirect back to this Track). Fires once per
 * signed-in visit. The submit itself is pure ({@link submitPendingAttempt});
 * this is the wiring.
 */
export function usePendingAttempt(trackId: string, signedIn: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!signedIn) return;
    void submitPendingAttempt({
      trackId,
      queryClient,
      storage: sessionStorageOrUndefined(),
    });
  }, [trackId, signedIn, queryClient]);
}
