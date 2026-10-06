import { Injectable } from '@nestjs/common';
import type {
  Mbid,
  RecordingSummary,
  SearchResultItem,
} from '@notefinder/contracts';
import { TracksRepository } from './tracks.repository.js';

@Injectable()
export class TracksService {
  constructor(private readonly tracksRepository: TracksRepository) {}

  /**
   * Track ids keyed by recording MBID, for the MBIDs given. Only processed
   * Recordings are present; the caller maps a miss to null (static card).
   */
  findTrackIdsByRecordingMbids(mbids: Mbid[]): Promise<Map<string, string>> {
    return this.tracksRepository.findTrackIdsByRecordingMbids(mbids);
  }

  /**
   * Enriches catalog summaries with the Track link, keeping the catalog's
   * order: each hit carries its Track id when notefinder already processed
   * that Recording, else null (the web renders a static card for those).
   */
  async attachTrackIds(
    results: RecordingSummary[],
  ): Promise<SearchResultItem[]> {
    const trackIds = await this.findTrackIdsByRecordingMbids(
      results.map((result) => result.mbid),
    );
    return results.map((result) => ({
      ...result,
      trackId: trackIds.get(result.mbid) ?? null,
    }));
  }
}
