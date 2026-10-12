import { Injectable } from '@nestjs/common';
import {
  type TrackNotes,
  type TrackPracticeArtist,
  type TrackPracticeHeader,
  trackNotesSchema,
} from '@notefinder/contracts';
import { TrackPracticeRepository } from './track-practice.repository.js';
import { TrackProcessingService } from './track-processing.service.js';

const sameName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * What the practice page reads of a Track. A legacy Track ID answers
 * `RESOURCE_MOVED` and an unknown one `NOT_FOUND`, as every Track read does.
 */
@Injectable()
export class TrackPracticeService {
  constructor(
    private readonly practice: TrackPracticeRepository,
    private readonly processing: TrackProcessingService,
  ) {}

  async getHeader(trackId: string): Promise<TrackPracticeHeader> {
    const row = await this.practice.findPracticeRow(trackId);
    if (row === undefined) {
      return this.processing.throwMovedOrMissing(trackId);
    }
    const artistCredit: TrackPracticeArtist[] = row.artistCredit.map(
      (entry) => ({
        ...entry,
        artistId:
          row.artists.find((artist) => sameName(artist.name, entry.name))?.id ??
          null,
      }),
    );
    return {
      id: row.id,
      title: row.title,
      coverUrl: row.coverUrl,
      artistCredit,
      durationMs: row.lengthMs,
      youtubeVideoId: row.youtubeVideoId,
      contributors: await this.processing.contributorsOf(trackId),
      hasNotes: row.hasNotes,
    };
  }

  async getNotes(trackId: string): Promise<TrackNotes> {
    const rows = await this.practice.findNotes(trackId);
    if (rows.length === 0) {
      // An instrumental Track has none; only an unknown ID is an error.
      await this.processing.assertTrackExists(trackId);
    }
    return trackNotesSchema.parse({ notes: rows });
  }
}
