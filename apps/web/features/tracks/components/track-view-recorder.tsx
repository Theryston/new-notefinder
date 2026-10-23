'use client';

import { useEffect, useState } from 'react';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { consumeClickId } from '@/lib/home-click-id';

import { useTrackView } from '../hooks/use-track-view';

function RecordView({
  trackId,
  signedIn,
  clickId,
}: {
  trackId: string;
  signedIn: boolean;
  clickId: string | undefined;
}) {
  useTrackView(trackId, signedIn, clickId);
  return null;
}

/**
 * Counts the visit to the Track page. It waits for the session to be known, so
 * a signed-in User is on the view from the start; it renders nothing.
 */
export function TrackViewRecorder({ trackId }: { trackId: string }) {
  const [clickId, setClickId] = useState<string | undefined>();
  const [readUrl, setReadUrl] = useState(false);
  useEffect(() => {
    const { clickId: found, cleanHref } = consumeClickId(window.location.href);
    if (found !== undefined) {
      window.history.replaceState(window.history.state, '', cleanHref);
    }
    setClickId(found);
    setReadUrl(true);
  }, []);
  if (!readUrl) return null;
  return (
    <SessionUserBoundary
      render={(user, loading) =>
        loading ? null : (
          <RecordView
            trackId={trackId}
            signedIn={user !== null}
            clickId={clickId}
          />
        )
      }
    />
  );
}
