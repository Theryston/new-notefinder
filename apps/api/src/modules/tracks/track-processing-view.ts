import {
  type TrackProcessing,
  type TrackProcessingFailureCode,
  type TrackProcessingStatus,
  type TrackProcessingStep,
  type TrackProcessingVideoSource,
} from '@notefinder/contracts';

/**
 * Failures that repeating the Processing cannot fix: no matching video, or a
 * Recording too long to process. Every other failure can be retried.
 */
const FINAL_FAILURE_CODES: readonly TrackProcessingFailureCode[] = [
  'VIDEO_NOT_FOUND',
  'TOO_LONG',
];

/** Whether a retry can pick a Processing up after this failure. */
export const isRetryableFailureCode = (
  code: TrackProcessingFailureCode,
): boolean => !FINAL_FAILURE_CODES.includes(code);

/** A Processing row as the read needs it. */
export type TrackProcessingRow = {
  id: string;
  status: TrackProcessingStatus;
  failureCode: TrackProcessingFailureCode | null;
  resumeFrom: TrackProcessingStep | null;
  videoId: string | null;
  videoSource: TrackProcessingVideoSource | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

/** The Processing as the API answers it, timestamps as ISO 8601 text. */
export function toTrackProcessing(row: TrackProcessingRow): TrackProcessing {
  const retryable =
    row.status === 'FAILED' &&
    row.failureCode !== null &&
    isRetryableFailureCode(row.failureCode);
  return {
    id: row.id,
    status: row.status,
    failureCode: row.failureCode,
    retryable,
    resumeFrom: row.resumeFrom,
    video:
      row.videoId === null || row.videoSource === null
        ? null
        : { id: row.videoId, source: row.videoSource },
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
