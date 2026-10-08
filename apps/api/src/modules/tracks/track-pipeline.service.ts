import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { cacheTags, type TrackProcessingStep } from '@notefinder/contracts';
import type { Queue } from 'bullmq';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import {
  firstPipelineStep,
  isStepDue,
  nextPipelineStep,
} from './track-pipeline-steps.js';
import {
  coverJobId,
  RUN_STEP_JOB,
  type RunStepJob,
  STORE_COVER_JOB,
  type StoreCoverJob,
  stepJobId,
  TRACK_PROCESSING_QUEUE,
} from './track-processing.job.js';
import {
  type ProcessingForStep,
  TrackProcessingRepository,
} from './track-processing.repository.js';
import { TrackProcessingFailure } from './track-processing-failure.js';
import { isRetryableFailureCode } from './track-processing-view.js';
import { TrackVideoStep } from './track-video-step.service.js';

/**
 * Runs a Track's Processing (ADR 0004). Each step job loads its Processing,
 * does its step, persists the result and enqueues the next step; the last step
 * completes the Processing and revalidates the Track's pages. A step that
 * fails for good marks the Processing `FAILED` with its code, and so does the
 * last attempt of a step that keeps failing.
 */
@Injectable()
export class TrackPipeline {
  private readonly logger = new Logger(TrackPipeline.name);

  constructor(
    @InjectQueue(TRACK_PROCESSING_QUEUE)
    private readonly queue: Queue<RunStepJob | StoreCoverJob>,
    private readonly processings: TrackProcessingRepository,
    private readonly videoStep: TrackVideoStep,
    private readonly revalidation: WebRevalidationService,
  ) {}

  /** Queues the first step of a Track's latest Processing (its request). */
  async start(trackId: string): Promise<void> {
    const latest = await this.processings.findLatestProcessing(trackId);
    if (latest === undefined) {
      throw new Error(`Track ${trackId} has no Processing to start`);
    }
    await this.enqueueStep(latest.id, firstPipelineStep());
  }

  /**
   * A step job. A Processing that is terminal, or already past this step, has
   * nothing due, so a replayed job changes nothing.
   */
  async runStep(job: RunStepJob, finalAttempt: boolean): Promise<void> {
    const processing = await this.processings.findProcessing(job.processingId);
    if (processing === undefined || !isStepDue(processing.status, job.step)) {
      return;
    }
    await this.processings.markStepStarted(processing.id, job.step);
    try {
      await this.performStep(job.step, processing);
      await this.advance(processing, job.step);
    } catch (error) {
      return this.failStep(processing, job.step, error, finalAttempt);
    }
  }

  /**
   * Queues the step after this one, or completes the Processing when this was
   * the last. Inside the step's try block, so a failure here is retried (and
   * replays the step, which is idempotent) rather than left half-done.
   */
  private advance(processing: ProcessingForStep, step: TrackProcessingStep) {
    const next = nextPipelineStep(step);
    return next === undefined
      ? this.complete(processing)
      : this.enqueueStep(processing.id, next);
  }

  private performStep(
    step: TrackProcessingStep,
    processing: ProcessingForStep,
  ): Promise<void> {
    switch (step) {
      case 'FINDING_VIDEO':
        return this.findVideo(processing);
      default:
        throw new Error(`The ${step} step has no handler yet`);
    }
  }

  /**
   * Chooses the video, then queues the cover: the cover job does not hold the
   * next step back.
   */
  private async findVideo(processing: ProcessingForStep): Promise<void> {
    await this.videoStep.run(processing);
    await this.enqueueCover(processing.trackId);
  }

  /**
   * A failure that repeating cannot fix (`VIDEO_NOT_FOUND`, `TOO_LONG`) ends the
   * Processing now. Any other failure is retried by BullMQ with backoff, and
   * ends the Processing with its code (or `INTERNAL`) on the last attempt.
   */
  private async failStep(
    processing: ProcessingForStep,
    step: TrackProcessingStep,
    error: unknown,
    finalAttempt: boolean,
  ): Promise<void> {
    const code =
      error instanceof TrackProcessingFailure ? error.code : undefined;
    const isFinal = code !== undefined && !isRetryableFailureCode(code);
    if (!isFinal && !finalAttempt) {
      throw error;
    }
    const failureCode = code ?? 'INTERNAL';
    this.logger.warn(
      `Processing ${processing.id} failed at ${step} with ${failureCode}: ${messageOf(error)}`,
    );
    await this.processings.markFailed(processing.id, {
      code: failureCode,
      resumeFrom: step,
    });
  }

  /**
   * The last step is done: the Track's pages refresh, then the Processing
   * completes. The refresh comes first, so if it fails the replayed job still
   * finds the Processing unfinished and refreshes again.
   */
  private async complete(processing: ProcessingForStep): Promise<void> {
    await this.revalidation.revalidate([
      cacheTags.track(processing.trackId),
      cacheTags.tracks,
    ]);
    await this.processings.markCompleted(processing.id);
  }

  private async enqueueStep(
    processingId: string,
    step: TrackProcessingStep,
  ): Promise<void> {
    await this.queue.add(
      RUN_STEP_JOB,
      { processingId, step },
      { jobId: stepJobId(processingId, step) },
    );
  }

  private async enqueueCover(trackId: string): Promise<void> {
    await this.queue.add(
      STORE_COVER_JOB,
      { trackId },
      { jobId: coverJobId(trackId) },
    );
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
