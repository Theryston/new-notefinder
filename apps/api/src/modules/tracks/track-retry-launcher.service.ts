import { Injectable } from '@nestjs/common';
import type {
  RetryTrackBody,
  TrackProcessingState,
} from '@notefinder/contracts';
import { TrackMetadataQueueService } from './track-metadata-queue.service.js';
import { TrackPipelineService } from './track-pipeline.service.js';
import { TrackProcessingService } from './track-processing.service.js';
import type { TrackRequester } from './track-requester.service.js';
import { TrackRetryService } from './track-retry.service.js';

/**
 * A retry that also starts its Processing. The retry's rows are written in one
 * transaction; its first step is queued here, after the commit, so the step
 * never runs before its rows exist. The answer is the Processing state the
 * page reads.
 */
@Injectable()
export class TrackRetryLauncherService {
  constructor(
    private readonly processingState: TrackProcessingService,
    private readonly retries: TrackRetryService,
    private readonly pipeline: TrackPipelineService,
    private readonly metadata: TrackMetadataQueueService,
  ) {}

  async retry(
    requester: TrackRequester,
    trackId: string,
    body: RetryTrackBody,
  ): Promise<TrackProcessingState> {
    await this.processingState.assertTrackExists(trackId);
    await this.retries.retry(requester, trackId, body.locale);
    // Every retry runs the metadata import again (ADR 0005): a first run may have
    // stopped before linking, and the import is idempotent. It is keyed by the
    // retry's Processing, so it gets a job of its own.
    await this.metadata.enqueueImport(trackId);
    await this.pipeline.startIfQueued(trackId);
    return this.processingState.getProcessingState(trackId);
  }
}
