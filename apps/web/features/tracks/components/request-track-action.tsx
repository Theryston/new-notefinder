'use client';

import type { ReactNode } from 'react';

import { useRequestTrack } from '../hooks/use-request-track';

/** The state and the trigger of the "generate notes" request for one Recording. */
export type RequestTrackState = {
  /** The request for this Recording's Track is on its way. */
  pending: boolean;
  onRequest: () => void;
};

/**
 * Hands the "generate notes" request of one Recording to its children: the
 * search card and the header suggestions fire the same mutation through it.
 * `onRequested` runs once the request succeeded (the Track exists, and the
 * request has navigated to its Processing page).
 */
export function RequestTrackAction({
  recordingMbid,
  onRequested,
  toasterId,
  children,
}: {
  recordingMbid: string;
  onRequested?: () => void;
  /** Sends a failure toast to the Toaster with this id (see `useRequestTrack`). */
  toasterId?: string;
  children: (request: RequestTrackState) => ReactNode;
}) {
  const request = useRequestTrack({ toasterId });
  return children({
    pending: request.isPending,
    onRequest: () => request.mutate(recordingMbid, { onSuccess: onRequested }),
  });
}
