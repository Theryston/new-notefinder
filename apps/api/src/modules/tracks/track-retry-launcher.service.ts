import { Injectable } from '@nestjs/common';
import type {
  RetryTrackBody,
  TrackProcessingState,
} from '@notefinder/contracts';
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
  ) {}

  async retry(
    requester: TrackRequester,
    trackId: string,
    body: RetryTrackBody,
  ): Promise<TrackProcessingState> {
    await this.processingState.assertTrackExists(trackId);
    await this.retries.retry(requester, trackId, body.locale);
    await this.pipeline.startIfQueued(trackId);
    return this.processingState.getProcessingState(trackId);
  }
}
