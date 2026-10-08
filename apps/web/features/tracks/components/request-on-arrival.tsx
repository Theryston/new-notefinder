'use client';

import { useEffect, useRef } from 'react';

import { SessionUserBoundary } from '@/features/auth/components/session-user';

import { useRequestTrack } from '../hooks/use-request-track';
import { recordingToRequestOnArrival } from '../request-on-arrival';

/**
 * Requests the Track of `recordingMbid` when a visitor arrives signed in with
 * its request marker in the URL. `onStart` runs before the request goes out,
 * so the caller can take the marker out of the URL first; the request then
 * takes the visitor to the Track's Processing page.
 */
export function RequestOnArrival({
  recordingMbid,
  onStart,
}: {
  recordingMbid: string;
  onStart: () => void;
}) {
  return (
    <SessionUserBoundary
      render={(user) => (
        <ArrivalRequest
          recordingMbid={recordingMbid}
          signedIn={user}
          onStart={onStart}
        />
      )}
    />
  );
}

function ArrivalRequest({
  recordingMbid,
  signedIn,
  onStart,
}: {
  recordingMbid: string;
  signedIn: { username: string | null } | null;
  onStart: () => void;
}) {
  const { mutate } = useRequestTrack();
  // What this page already requested: a re-run of the effect (Strict Mode, or
  // a re-render before the marker leaves the URL) must not request it again.
  const requested = useRef<string | null>(null);

  useEffect(() => {
    const target = recordingToRequestOnArrival({
      marker: recordingMbid,
      signedIn,
      requested: requested.current,
    });
    if (target === null) return;
    requested.current = target;
    onStart();
    mutate(target);
  }, [recordingMbid, signedIn, onStart, mutate]);

  return null;
}
