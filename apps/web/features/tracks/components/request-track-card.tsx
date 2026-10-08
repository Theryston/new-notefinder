'use client';

import { useRequestTrack } from '../hooks/use-request-track';
import { TrackCard, type TrackCardProps } from './track-card';

/**
 * A search result without a Track: its card asks for one on click, and
 * navigates to the Processing page once the Track exists.
 */
export function RequestTrackCard({
  recordingMbid,
  ...card
}: Omit<TrackCardProps, 'request' | 'trackId'> & { recordingMbid: string }) {
  const request = useRequestTrack();
  return (
    <TrackCard
      {...card}
      trackId={null}
      request={{
        pending: request.isPending,
        onRequest: () => request.mutate(recordingMbid),
      }}
    />
  );
}
