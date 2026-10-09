import { Injectable, Logger } from '@nestjs/common';
import {
  CoverArtClient,
  type DownloadedImage,
} from '../../integrations/cover-art/cover-art.client.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { YouTubeMusicClient } from '../../integrations/youtube-music/youtube-music.client.js';
import { COVER_CONTENT_TYPE, toStoredCover } from './track-cover-image.js';
import { primaryReleaseOf } from './track-primary-release.js';
import {
  chooseSearchMatch,
  recordingTargetOf,
  searchQueryOf,
} from './track-video-matching.js';
import { type PipelineTrack, TracksRepository } from './tracks.repository.js';

/** The key a Track's cover is stored under; one per Track. */
const coverKey = (trackId: string): string => `track-covers/${trackId}.webp`;

/**
 * Stores a Track's cover (ADR 0004): the front cover of its primary release
 * from the Cover Art Archive, else the artwork of the best search match, else
 * no cover (the page keeps its placeholder).
 */
@Injectable()
export class TrackCoverService {
  private readonly logger = new Logger(TrackCoverService.name);

  constructor(
    private readonly tracks: TracksRepository,
    private readonly coverArt: CoverArtClient,
    private readonly youtube: YouTubeMusicClient,
    private readonly storage: StorageService,
  ) {}

  /**
   * Stores the cover of a Track that has none yet; answers whether one was
   * stored now. A replayed job, or a Track that already has a cover, changes
   * nothing.
   *
   * @param artworkUrl the artwork of the best search match, as the video step
   * found it; `undefined` when that step did not search, and the search runs
   * here.
   */
  async storeCover(
    trackId: string,
    artworkUrl: string | null | undefined,
  ): Promise<boolean> {
    const track = await this.tracks.findPipelineTrack(trackId);
    if (track === undefined || track.coverUrl !== null) {
      return false;
    }
    const image = await this.findCoverImage(track, artworkUrl);
    if (image === undefined) {
      return false;
    }
    const body = await toStoredCover(image.bytes);
    if (body === undefined) {
      this.logger.warn(`The cover of Track ${trackId} is not an image`);
      return false;
    }
    const key = coverKey(trackId);
    await this.storage.putPublicObject({
      key,
      body,
      contentType: COVER_CONTENT_TYPE,
    });
    await this.tracks.setCoverUrl(trackId, this.storage.publicUrl(key));
    return true;
  }

  private async findCoverImage(
    track: PipelineTrack,
    artworkUrl: string | null | undefined,
  ): Promise<DownloadedImage | undefined> {
    const primary = primaryReleaseOf(track.releases);
    if (primary !== undefined) {
      const releaseCover = await this.coverArt.fetchReleaseFrontCover(
        primary.mbid,
      );
      if (releaseCover !== undefined) {
        return releaseCover;
      }
    }
    const url =
      artworkUrl === undefined
        ? await this.searchArtworkUrl(track)
        : artworkUrl;
    return url === null ? undefined : this.coverArt.fetchImage(url);
  }

  /** The artwork of the best search match, when it has one. */
  private async searchArtworkUrl(track: PipelineTrack): Promise<string | null> {
    const target = recordingTargetOf(track);
    const results = await this.youtube.searchSongs(searchQueryOf(target));
    return chooseSearchMatch(target, results)?.artworkUrl ?? null;
  }
}
