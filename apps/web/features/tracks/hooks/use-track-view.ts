'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { postTrackView } from '../track-view-query';
import {
  nextViewAction,
  readStoredView,
  sessionStorageOrUndefined,
  writeStoredView,
} from '../track-view-session';

/**
 * Counts the visit once per browser session: the first one records a view and
 * keeps its ID in session storage; a User who signs in later in the session is
 * attached to that view by posting the stored ID. The logic is in
 * `track-view-session.ts`; this is the wiring. A failure is silent: a missed
 * view is not worth interrupting the page for.
 */
export function useTrackView(trackId: string, signedIn: boolean) {
  // Strict Mode runs effects twice; a ref survives that remount.
  const sent = useRef<string | null>(null);
  const { mutate } = useMutation({
    mutationFn: ({ viewId }: { viewId: string | undefined }) =>
      postTrackView(trackId, viewId),
    onSuccess: (viewId) =>
      writeStoredView(sessionStorageOrUndefined(), trackId, {
        viewId,
        attached: signedIn,
      }),
  });

  useEffect(() => {
    const stored = readStoredView(sessionStorageOrUndefined(), trackId);
    const action = nextViewAction(stored, signedIn);
    const attempt = `${trackId}:${action}:${signedIn}`;
    if (action === 'none' || sent.current === attempt) return;
    sent.current = attempt;
    mutate({ viewId: action === 'attach' ? stored?.viewId : undefined });
  }, [trackId, signedIn, mutate]);
}
