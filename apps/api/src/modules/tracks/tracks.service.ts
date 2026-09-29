import { Injectable } from '@nestjs/common';
import type { ListTracksQuery, TrackSummaryPage } from '@notefinder/contracts';
import { decodeTrackCursor, encodeTrackCursor } from './track-cursor.js';
import { toTrackSummaries } from './track-summaries.js';
import { type TrackOwner, TracksRepository } from './tracks.repository.js';

@Injectable()
export class TracksService {
  constructor(private readonly tracksRepository: TracksRepository) {}

  /**
   * A page of the completed tracks of an artist or album (the only ones
   * with notes to show), most popular first.
   *
   * @throws {ZodValidationException} when `cursor` is not one this API made.
   */
  async listCompleted(
    owner: TrackOwner,
    { cursor, limit }: ListTracksQuery,
  ): Promise<TrackSummaryPage> {
    const after = cursor === undefined ? undefined : decodeTrackCursor(cursor);
    // One extra row tells whether another page exists.
    const rows = await this.tracksRepository.listCompleted(owner, {
      after,
      limit: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      rows.length > limit && last ? encodeTrackCursor(last) : null;

    if (page.length === 0) {
      return { items: [], nextCursor };
    }
    const trackIds = page.map((row) => row.id);
    const [artists, thumbnails, vocalRanges] = await Promise.all([
      this.tracksRepository.findArtists(trackIds),
      this.tracksRepository.findThumbnails(trackIds),
      this.tracksRepository.findVocalRanges(trackIds),
    ]);
    return {
      items: toTrackSummaries(page, { artists, thumbnails, vocalRanges }),
      nextCursor,
    };
  }

  countCompleted(owner: TrackOwner): Promise<number> {
    return this.tracksRepository.countCompleted(owner);
  }
}
