import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { cacheTags, type TrackProcessingStep } from '@notefinder/contracts';
import { type Queue, UnrecoverableError } from 'bullmq';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import {
  dueStatusesOf,
  firstPipelineStep,
  isPipelineStep,
  isStepDue,
  nextPipelineStep,
  type PipelineStepName,
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
import {
  messageOf,
  TrackProcessingFailure,
} from './track-processing-failure.js';
import { isRetryableFailureCode } from './track-processing-view.js';
import { TrackVideoStepService } from './track-video-step.service.js';

/** What one step does with its Processing. */
type StepHandler = (processing: ProcessingForStep) => Promise<void>;

/**
 * Runs a Track's Processing (ADR 0004). Each step job loads its Processing,
 * does its step, persists the result and enqueues the next step; the last step
 * completes the Processing and revalidates the Track's pages. A step that
 * fails for good marks the Processing `FAILED` with its code, and so does the
 * last attempt of a step that keeps failing.
 */
@Injectable()
export class TrackPipelineService {
  private readonly logger = new Logger(TrackPipelineService.name);

  /**
   * What each step of the pipeline does. Typed on the step list, so a step
   * added there without its handler here does not compile.
   */
  private readonly handlers: Record<PipelineStepName, StepHandler> = {
    FINDING_VIDEO: (processing) => this.findVideo(processing),
  };

  constructor(
    @InjectQueue(TRACK_PROCESSING_QUEUE)
    private readonly queue: Queue<RunStepJob | StoreCoverJob>,
    private readonly processings: TrackProcessingRepository,
    private readonly videoStep: TrackVideoStepService,
    private readonly revalidation: WebRevalidationService,
  ) {}

  /**
   * Queues the first step of a Track's latest Processing when that Processing
   * has not started: the request of a new Track, or a later request for a
   * Track whose first start failed. A queued retry starts at the step its row
   * names (`resumeFrom`). Job IDs are keyed by the Processing, so queuing it
   * again while the first job is kept does nothing.
   */
  async startIfQueued(trackId: string): Promise<void> {
    const latest = await this.processings.findLatestProcessing(trackId);
    if (latest?.status !== 'QUEUED') {
      return;
    }
    // A retry's row names the step it starts at; a first run starts at the first step.
    await this.enqueueStep(latest.id, latest.resumeFrom ?? firstPipelineStep());
  }

  /**
   * A step job. A Processing that is terminal, or already past this step, has
   * nothing due, so a replayed job changes nothing. A job that runs late is
   * stopped by the guarded write that starts the step.
   */
  async runStep(job: RunStepJob, finalAttempt: boolean): Promise<void> {
    if (!isPipelineStep(job.step)) {
      throw new UnrecoverableError(
        `The ${job.step} step is not part of this build`,
      );
    }
    const processing = await this.processings.findProcessing(job.processingId);
    if (processing === undefined || !isStepDue(processing.status, job.step)) {
      return;
    }
    const started = await this.processings.markStepStarted(
      processing.id,
      job.step,
      dueStatusesOf(job.step),
    );
    if (!started) {
      return;
    }
    try {
      await this.handlers[job.step](processing);
      await this.advance(processing, job.step);
    } catch (error) {
      return this.failStep(processing, job.step, error, finalAttempt);
    }
  }

  /**
   * Chooses the video, then queues the cover with the artwork the search
   * found, so the cover job does not search again. The cover job does not hold
   * the next step back.
   */
  private async findVideo(processing: ProcessingForStep): Promise<void> {
    const artworkUrl = await this.videoStep.run(processing);
    await this.enqueueCover({
      trackId: processing.trackId,
      processingId: processing.id,
      artworkUrl,
    });
  }

  /**
   * Queues the step after this one, or completes the Processing when this was
   * the last. Inside the step's try block, so a failure here is retried (and
   * replays the step, which is idempotent) rather than left half-done.
   */
  private advance(processing: ProcessingForStep, step: PipelineStepName) {
    const next = nextPipelineStep(step);
    return next === undefined
      ? this.complete(processing, step)
      : this.enqueueStep(processing.id, next);
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
    await this.processings.markFailed(processing.id, dueStatusesOf(step), {
      code: failureCode,
      resumeFrom: step,
    });
  }

  /**
   * The last step is done: the Track's pages refresh, then the Processing
   * completes. The refresh comes first, so if it fails the replayed job still
   * finds the Processing unfinished and refreshes again.
   */
  private async complete(
    processing: ProcessingForStep,
    lastStep: PipelineStepName,
  ): Promise<void> {
    await this.revalidation.revalidate([
      cacheTags.track(processing.trackId),
      cacheTags.tracks,
    ]);
    await this.processings.markCompleted(processing.id, lastStep);
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

  private async enqueueCover(job: StoreCoverJob): Promise<void> {
    await this.queue.add(STORE_COVER_JOB, job, {
      jobId: coverJobId(job.processingId),
    });
  }
}
