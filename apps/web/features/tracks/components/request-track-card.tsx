'use client';

import { RequestTrackAction } from './request-track-action';
import { TrackCard, type TrackCardProps } from './track-card';

/**
 * A search result without a Track: its card asks for one on click, and
 * navigates to the Processing page once the Track exists.
 */
export function RequestTrackCard({
  recordingMbid,
  ...card
}: Omit<TrackCardProps, 'request' | 'trackId'> & { recordingMbid: string }) {
  return (
    <RequestTrackAction recordingMbid={recordingMbid}>
      {(request) => <TrackCard {...card} trackId={null} request={request} />}
    </RequestTrackAction>
  );
}
