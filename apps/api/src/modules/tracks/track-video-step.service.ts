import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import {
  type ProcessingForStep,
  TrackProcessingRepository,
} from './track-processing.repository.js';
import { type ChosenVideo, TrackVideoService } from './track-video.service.js';
import { TracksRepository } from './tracks.repository.js';

/**
 * The find-video step (ADR 0004): chooses the video of a Processing and saves
 * it on the Processing and on its Track, in one unit. A run that finds a video
 * already chosen (a retry, or a job replayed after its save) keeps that video.
 */
@Injectable()
export class TrackVideoStep {
  constructor(
    private readonly tracks: TracksRepository,
    private readonly processings: TrackProcessingRepository,
    private readonly videos: TrackVideoService,
  ) {}

  /** @throws {TrackProcessingFailure} when no video can be chosen. */
  async run(processing: ProcessingForStep): Promise<void> {
    if (processing.videoId !== null && processing.videoSource !== null) {
      return;
    }
    const track = await this.tracks.findPipelineTrack(processing.trackId);
    if (track === undefined) {
      throw new Error(
        `Track ${processing.trackId} disappeared during its Processing`,
      );
    }
    const chosen = await this.videos.findVideo(track);
    await this.save(processing.id, track.id, chosen);
  }

  @Transactional()
  private async save(
    processingId: string,
    trackId: string,
    chosen: ChosenVideo,
  ): Promise<void> {
    await this.processings.saveVideo(processingId, chosen);
    await this.tracks.setYoutubeVideoId(trackId, chosen.videoId);
  }
}
