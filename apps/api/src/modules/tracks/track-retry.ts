import type {
  TrackProcessingFailureCode,
  TrackProcessingStatus,
  TrackProcessingStep,
} from '@notefinder/contracts';
import {
  type CarriedOutputs,
  carriedOutputsOf,
  type ProcessingOutputs,
} from './track-processing-outputs.js';
import { isRetryableFailureCode } from './track-processing-view.js';

/** The latest Processing of a Track, as a retry reads it. */
export type RetryableProcessing = ProcessingOutputs & {
  status: TrackProcessingStatus;
  failureCode: TrackProcessingFailureCode | null;
  resumeFrom: TrackProcessingStep | null;
};

/** What the new Processing of a retry starts with: its step and the carried outputs. */
export type RetryPlan = {
  resumeFrom: TrackProcessingStep;
  outputs: CarriedOutputs;
};

/**
 * The plan of a retry of the latest Processing, or undefined when it cannot be
 * retried: there is no Processing, it is not `FAILED`, or its failure is one
 * repeating cannot fix (`VIDEO_NOT_FOUND`, `TOO_LONG`).
 */
export function retryPlanOf(
  latest: RetryableProcessing | undefined,
): RetryPlan | undefined {
  if (latest === undefined || latest.status !== 'FAILED') {
    return undefined;
  }
  if (
    latest.failureCode === null ||
    !isRetryableFailureCode(latest.failureCode)
  ) {
    return undefined;
  }
  if (latest.resumeFrom === null) {
    return undefined;
  }
  return { resumeFrom: latest.resumeFrom, outputs: carriedOutputsOf(latest) };
}
