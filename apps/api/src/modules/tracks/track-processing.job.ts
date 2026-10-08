import {
  type TrackProcessingStep,
  trackProcessingStepSchema,
} from '@notefinder/contracts';
import { z } from 'zod';

// The queue of a Track's Processing (ADR 0004): each step is a job that loads
// its Processing, does its step, persists and enqueues the next one. The cover
// is a job of its own, so it never holds a step back.

export const TRACK_PROCESSING_QUEUE = 'track-processing';
export const RUN_STEP_JOB = 'run-step';
export const STORE_COVER_JOB = 'store-cover';

export const runStepJobSchema = z.object({
  processingId: z.string().min(1).max(128),
  step: trackProcessingStepSchema,
});

export type RunStepJob = z.infer<typeof runStepJobSchema>;

export const storeCoverJobSchema = z.object({
  trackId: z.string().min(1).max(128),
});

export type StoreCoverJob = z.infer<typeof storeCoverJobSchema>;

/**
 * Job IDs make a repeated enqueue a no-op while the first job is kept: a step
 * of a Processing is queued once, and so is a Track's cover.
 */
export const stepJobId = (processingId: string, step: TrackProcessingStep) =>
  `step-${processingId}-${step}`;

export const coverJobId = (trackId: string) => `cover-${trackId}`;
