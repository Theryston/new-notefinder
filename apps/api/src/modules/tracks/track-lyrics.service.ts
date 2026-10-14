import { Injectable } from '@nestjs/common';
import type { TrackLyrics } from '@notefinder/contracts';
import { TrackLyricsRepository } from './track-lyrics.repository.js';
import { TrackProcessingService } from './track-processing.service.js';

/**
 * What the Track page reads of a Track's Timed lyrics. A legacy Track ID
 * answers `RESOURCE_MOVED` and an unknown one `NOT_FOUND`, as every Track read.
 */
@Injectable()
export class TrackLyricsService {
  constructor(
    private readonly lyrics: TrackLyricsRepository,
    private readonly processing: TrackProcessingService,
  ) {}

  async getLyrics(trackId: string): Promise<TrackLyrics> {
    const lines = await this.lyrics.findTimedLyrics(trackId);
    if (lines.length === 0) {
      // A Track without Timed lyrics has none; only an unknown ID is an error.
      await this.processing.assertTrackExists(trackId);
    }
    return { lines };
  }
}
