'use client';

import { useEffect, useState } from 'react';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { consumeClickId } from '@/lib/home-click-id';
import { getOrCreateVisitorId } from '@/lib/visitor-id';

import { useTrackView } from '../hooks/use-track-view';

function RecordView({
  trackId,
  signedIn,
  clickId,
  visitorId,
}: {
  trackId: string;
  signedIn: boolean;
  clickId: string | undefined;
  visitorId: string | undefined;
}) {
  useTrackView(trackId, signedIn, clickId, visitorId);
  return null;
}

/**
 * Counts the visit to the Track page. It waits for the session to be known, so
 * a signed-in User is on the view from the start; it renders nothing.
 */
export function TrackViewRecorder({ trackId }: { trackId: string }) {
  const [clickId, setClickId] = useState<string | undefined>();
  const [readUrl, setReadUrl] = useState(false);
  const [visitorId, setVisitorId] = useState<string | undefined>();
  useEffect(() => {
    const { clickId: found, cleanHref } = consumeClickId(window.location.href);
    if (found !== undefined) {
      window.history.replaceState(window.history.state, '', cleanHref);
    }
    setClickId(found);
    try {
      setVisitorId(getOrCreateVisitorId(window.localStorage));
    } catch {
      setVisitorId(undefined);
    }
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
            visitorId={visitorId}
          />
        )
      }
    />
  );
}
