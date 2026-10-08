'use client';

import {
  type TrackProcessingState,
  trackProcessingStateSchema,
} from '@notefinder/contracts';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { browserApi } from '@/lib/api/browser';

import {
  PROCESSING_POLL_INTERVAL_MS,
  processingRefetchInterval,
} from '../processing-polling';
import { trackKeys } from '../query-keys';

/**
 * The Processing state of a Track, read from the browser and polled while the
 * Processing runs. The server's state arrives as `initialState`, so the page
 * renders without a loading flash.
 */
function trackProcessingQueryOptions(
  trackId: string,
  initialState: TrackProcessingState,
) {
  return queryOptions({
    queryKey: trackKeys.processing(trackId),
    queryFn: ({ signal }) =>
      browserApi(`/tracks/${encodeURIComponent(trackId)}/processing`, {
        schema: trackProcessingStateSchema,
        signal,
      }),
    initialData: initialState,
    // The server's state is fresh when it arrives, so the first poll waits a
    // full interval.
    staleTime: PROCESSING_POLL_INTERVAL_MS,
    refetchInterval: (query) => processingRefetchInterval(query.state.data),
  });
}

/** The Track's Processing state, kept current until the Processing is terminal. */
export function useTrackProcessing(
  trackId: string,
  initialState: TrackProcessingState,
) {
  return useQuery(trackProcessingQueryOptions(trackId, initialState));
}
