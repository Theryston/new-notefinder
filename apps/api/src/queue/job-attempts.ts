import type { Job } from 'bullmq';

/**
 * Whether BullMQ stops retrying this job when the current attempt throws, so
 * the processor knows whether a failure is final. Shared by every processor.
 */
export const isFinalAttempt = (job: Job<unknown>): boolean =>
  job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
