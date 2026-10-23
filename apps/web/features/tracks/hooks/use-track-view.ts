'use client';

import { useMutation } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useEffect, useRef } from 'react';

import { synchronizeTrackView } from '../track-view-sync';

/**
 * Counts the visit once per browser session: the first one records a view and
 * keeps its ID in session storage; a User who signs in later in the session is
 * attached to that view by posting the stored ID. The logic is in
 * `track-view-session.ts`; this is the wiring. A failure is silent: a missed
 * view is not worth interrupting the page for.
 */
export function useTrackView(
  trackId: string,
  signedIn: boolean,
  clickId: string | undefined,
  visitorId: string | undefined,
) {
  // Strict Mode runs effects twice; a ref survives that remount.
  const sent = useRef<string | null>(null);
  const locale = useLocale();
  const { mutate } = useMutation({
    mutationFn: () =>
      synchronizeTrackView(trackId, signedIn, locale, { clickId, visitorId }),
  });

  useEffect(() => {
    const attempt = `${trackId}:${signedIn}:${clickId ?? ''}:${visitorId ?? ''}`;
    if (sent.current === attempt) return;
    sent.current = attempt;
    mutate();
  }, [trackId, signedIn, clickId, visitorId, mutate]);
}
