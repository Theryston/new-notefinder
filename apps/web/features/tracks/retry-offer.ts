import type { TrackProcessing } from '@notefinder/contracts';

/**
 * Whether the Processing page offers "Try again": the Processing failed with a
 * reason a retry can pick up (the API says so in `retryable`).
 */
export function isRetryOffered(processing: TrackProcessing | null): boolean {
  return processing?.status === 'FAILED' && processing.retryable;
}

/**
 * Where a signed-out visitor goes to sign in and come back: the Track's own
 * page, which offers the retry again once they are signed in.
 */
export function retrySignInPath(trackId: string): string {
  return `/tracks/${encodeURIComponent(trackId)}`;
}
