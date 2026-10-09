import { Injectable } from '@nestjs/common';
import type { CreateTrackBody } from '@notefinder/contracts';
import { TrackMetadataService } from './track-metadata.service.js';
import { type RequestedTrack } from './track-request.service.js';
import { TrackRequestLauncherService } from './track-request-launcher.service.js';
import type { TrackRequester } from './track-requester.service.js';

/**
 * A Track request and everything a new Track starts: its Processing (through
 * the launcher), and its metadata import, which runs beside the Processing.
 * A request for a Track that already exists starts nothing new.
 */
@Injectable()
export class TrackRequestFlowService {
  constructor(
    private readonly launcher: TrackRequestLauncherService,
    private readonly metadata: TrackMetadataService,
  ) {}

  async requestTrack(
    requester: TrackRequester,
    body: CreateTrackBody,
  ): Promise<RequestedTrack> {
    const requested = await this.launcher.requestTrack(requester, body);
    if (requested.created) {
      await this.metadata.enqueueImport(requested.trackId);
    }
    return requested;
  }
}
