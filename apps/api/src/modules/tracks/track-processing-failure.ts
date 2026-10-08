import type { TrackProcessingFailureCode } from '@notefinder/contracts';

/**
 * A step that ends the Processing with a known failure code (`VIDEO_NOT_FOUND`,
 * `TOO_LONG`, ...). Anything else a step throws is an `INTERNAL` failure, and
 * is retried with backoff until its last attempt.
 */
export class TrackProcessingFailure extends Error {
  override readonly name = 'TrackProcessingFailure';

  constructor(readonly code: TrackProcessingFailureCode) {
    super(`Processing failed: ${code}`);
  }
}
