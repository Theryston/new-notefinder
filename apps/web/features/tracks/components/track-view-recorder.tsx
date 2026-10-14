'use client';

import { SessionUserBoundary } from '@/features/auth/components/session-user';

import { useTrackView } from '../hooks/use-track-view';

function RecordView({
  trackId,
  signedIn,
}: {
  trackId: string;
  signedIn: boolean;
}) {
  useTrackView(trackId, signedIn);
  return null;
}

/**
 * Counts the visit to the Track page. It waits for the session to be known, so
 * a signed-in User is on the view from the start; it renders nothing.
 */
export function TrackViewRecorder({ trackId }: { trackId: string }) {
  return (
    <SessionUserBoundary
      render={(user, loading) =>
        loading ? null : (
          <RecordView trackId={trackId} signedIn={user !== null} />
        )
      }
    />
  );
}
