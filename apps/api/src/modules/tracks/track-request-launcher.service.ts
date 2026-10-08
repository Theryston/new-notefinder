import { Injectable } from '@nestjs/common';
import type { CreateTrackBody } from '@notefinder/contracts';
import { TrackPipeline } from './track-pipeline.service.js';
import {
  type RequestedTrack,
  TrackRequestService,
} from './track-request.service.js';

/**
 * A Track request that also starts the Track's Processing when the request
 * created the Track. It starts after the Track is written, so the first step
 * never runs before the rows it reads exist.
 */
@Injectable()
export class TrackRequestLauncher {
  constructor(
    private readonly requests: TrackRequestService,
    private readonly pipeline: TrackPipeline,
  ) {}

  async requestTrack(
    userId: string,
    body: CreateTrackBody,
  ): Promise<RequestedTrack> {
    const requested = await this.requests.requestTrack(userId, body);
    if (requested.created) {
      await this.pipeline.start(requested.trackId);
    }
    return requested;
  }
}
