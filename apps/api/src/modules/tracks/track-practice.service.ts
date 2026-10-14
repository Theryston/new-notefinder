import { Injectable } from '@nestjs/common';
import type { TrackDetail, TrackNotes } from '@notefinder/contracts';
import { TrackPracticeRepository } from './track-practice.repository.js';
import { TrackProcessingService } from './track-processing.service.js';

/**
 * What the Track page reads of a Track. A legacy Track ID answers
 * `RESOURCE_MOVED` and an unknown one `NOT_FOUND`, as every Track read does.
 */
@Injectable()
export class TrackPracticeService {
  constructor(
    private readonly practice: TrackPracticeRepository,
    private readonly processing: TrackProcessingService,
  ) {}

  async getHeader(trackId: string): Promise<TrackDetail> {
    const row = await this.practice.findPracticeRow(trackId);
    if (row === undefined) {
      return this.processing.throwMovedOrMissing(trackId);
    }
    // A name links to its Artist by the MBID the credit stored, since the
    // credited name often differs from the Artist's own ("Beyonce"). Credits
    // stored without an MBID are not linked.
    const artistIds = new Map(
      row.artists.map((artist) => [artist.mbid, artist.id]),
    );
    return {
      id: row.id,
      title: row.title,
      coverUrl: row.coverUrl,
      artistCredit: row.artistCredit.map((entry) => ({
        name: entry.name,
        joinPhrase: entry.joinPhrase,
        artistId:
          entry.mbid === undefined ? null : (artistIds.get(entry.mbid) ?? null),
      })),
      durationMs: row.lengthMs,
      youtubeVideoId: row.youtubeVideoId,
      contributors: await this.processing.contributorsOf(trackId),
      hasNotes: row.hasNotes,
      viewCount: row.viewCount,
    };
  }

  async getNotes(trackId: string): Promise<TrackNotes> {
    const notes = await this.practice.findNotes(trackId);
    if (notes.length === 0) {
      // An instrumental Track has none; only an unknown ID is an error.
      await this.processing.assertTrackExists(trackId);
    }
    return { notes };
  }
}
