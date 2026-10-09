'use client';

import { useEffect, useRef } from 'react';

import { SessionUserBoundary } from '@/features/auth/components/session-user';

import { useRequestTrack } from '../hooks/use-request-track';
import { arrivalStep } from '../request-on-arrival';
import { hasRequested, tabRequestMarks } from '../request-once';

/**
 * Acts on the request marker a visitor arrives with: asks for the Track of
 * `recordingMbid` once a signed-in visitor has a username, or only clears the
 * marker when this tab already asked (see `arrivalStep`). `onStart` runs before
 * anything else, so the caller takes the marker out of the URL first; the
 * request then takes the visitor to the Track's Processing page.
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
  // The marker this page already acted on: a re-run of the effect (Strict Mode,
  // or a re-render before the marker leaves the URL) must not act twice.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const step = arrivalStep({
      marker: recordingMbid,
      signedIn,
      handled: handled.current,
      alreadyRequested: hasRequested(tabRequestMarks(), recordingMbid),
    });
    if (step === 'wait') return;
    handled.current = recordingMbid;
    onStart();
    if (step === 'request') mutate(recordingMbid);
  }, [recordingMbid, signedIn, onStart, mutate]);

  return null;
}
