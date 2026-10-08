import { Injectable } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import type { z } from 'zod';
import { TrackCoverJob } from './track-cover-job.service.js';
import { TrackPipeline } from './track-pipeline.service.js';
import {
  RUN_STEP_JOB,
  runStepJobSchema,
  STORE_COVER_JOB,
  storeCoverJobSchema,
} from './track-processing.job.js';

/**
 * Routes one job of the Processing queue to its handler: a step to the
 * pipeline, a cover to the cover job. The BullMQ processor and the e2e specs
 * both go through here, so a job runs the same way in both.
 */
@Injectable()
export class TrackJobRunner {
  constructor(
    private readonly pipeline: TrackPipeline,
    private readonly coverJob: TrackCoverJob,
  ) {}

  /**
   * `finalAttempt` tells whether BullMQ gives up on the job when this run
   * throws, which is when a failure is final.
   */
  async run(name: string, data: unknown, finalAttempt: boolean): Promise<void> {
    if (name === RUN_STEP_JOB) {
      return this.pipeline.runStep(
        parseJob(runStepJobSchema, data),
        finalAttempt,
      );
    }
    if (name === STORE_COVER_JOB) {
      const { trackId } = parseJob(storeCoverJobSchema, data);
      return this.coverJob.run(trackId, finalAttempt);
    }
    throw new UnrecoverableError(`Unknown job "${name}"`);
  }
}

/** A job's payload, parsed; a payload that breaks its schema never succeeds. */
function parseJob<TOutput>(schema: z.ZodType<TOutput>, data: unknown): TOutput {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new UnrecoverableError('Invalid job payload');
  }
  return parsed.data;
}
