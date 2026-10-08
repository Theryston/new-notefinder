import { Injectable } from '@nestjs/common';
import type { CreateTrackBody } from '@notefinder/contracts';
import { TrackPipelineService } from './track-pipeline.service.js';
import {
  type RequestedTrack,
  TrackRequestService,
} from './track-request.service.js';

/**
 * A Track request that also starts the Track's Processing while it is still
 * queued. A new Track is started here, after its rows are written, so the first
 * step never runs before them. A Track that already exists is started only if
 * an earlier request failed to queue its first step: that answer is still 200
 * with no rows written. A Track whose Processing has started or ended is left
 * alone.
 */
@Injectable()
export class TrackRequestLauncherService {
  constructor(
    private readonly requests: TrackRequestService,
    private readonly pipeline: TrackPipelineService,
  ) {}

  async requestTrack(
    userId: string,
    body: CreateTrackBody,
  ): Promise<RequestedTrack> {
    const requested = await this.requests.requestTrack(userId, body);
    await this.pipeline.startIfQueued(requested.trackId);
    return requested;
  }
}
