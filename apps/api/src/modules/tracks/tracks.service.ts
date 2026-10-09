import { Injectable } from '@nestjs/common';
import type {
  CatalogTrack,
  Mbid,
  RecordingSummary,
  SearchResultItem,
} from '@notefinder/contracts';
import { TracksRepository } from './tracks.repository.js';

@Injectable()
export class TracksService {
  constructor(private readonly tracksRepository: TracksRepository) {}

  /**
   * The catalog details of the Tracks given, in the order given. Every list
   * of catalog tracks (an artist's, an album's) reads them through here, so
   * they all show the same `CatalogTrack`. IDs with no Track are left out.
   * Reads never touch the Music catalog.
   */
  async getCatalogTracks(trackIds: readonly string[]): Promise<CatalogTrack[]> {
    const found = await this.tracksRepository.findCatalogTracks([...trackIds]);
    const byId = new Map(found.map((track) => [track.id, track]));
    return trackIds.flatMap((trackId) => {
      const track = byId.get(trackId);
      return track ? [track] : [];
    });
  }

  /** The MBID of the Recording a Track was created from; undefined for an unknown Track. */
  findRecordingMbid(trackId: string): Promise<string | undefined> {
    return this.tracksRepository.findRecordingMbid(trackId);
  }

  /** Whether the Track has a completed Processing, the state its Artist and Album pages list it in. */
  isTrackCompleted(trackId: string): Promise<boolean> {
    return this.tracksRepository.isTrackCompleted(trackId);
  }

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
