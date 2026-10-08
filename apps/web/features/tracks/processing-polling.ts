import {
  isTrackProcessingTerminal,
  type TrackProcessingState,
} from '@notefinder/contracts';

/** How often the Processing page asks the API for the state while it runs. */
export const PROCESSING_POLL_INTERVAL_MS = 1_500;

/**
 * The polling interval for the state the page holds, or `false` once there is
 * nothing left to wait for: a Processing that completed or failed, or a Track
 * that never had one.
 */
export function processingRefetchInterval(
  state: TrackProcessingState | undefined,
): number | false {
  if (state === undefined || state.processing === null) {
    return false;
  }
  return isTrackProcessingTerminal(state.processing.status)
    ? false
    : PROCESSING_POLL_INTERVAL_MS;
}
