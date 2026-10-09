import type { TrackProcessing } from '@notefinder/contracts';

import { isApiError } from '@/lib/api/api-error';

/**
 * Whether the Processing page offers "Try again": the Processing failed with a
 * reason a retry can pick up (the API says so in `retryable`).
 */
export function isRetryOffered(processing: TrackProcessing | null): boolean {
  return processing?.status === 'FAILED' && processing.retryable;
}

/**
 * Whether a refused retry means the Processing moved on: another retry got
 * there first, so the page is stale and must read the Track again.
 */
export function isRetryConflict(error: unknown): boolean {
  return isApiError(error) && error.code === 'CONFLICT';
}

/**
 * Where a signed-out visitor goes to sign in and come back: the Track's own
 * page, which offers the retry again once they are signed in.
 */
export function retrySignInPath(trackId: string): string {
  return `/tracks/${encodeURIComponent(trackId)}`;
}
