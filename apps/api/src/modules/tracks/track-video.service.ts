import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TrackProcessingVideoSource } from '@notefinder/contracts';
import { ENV, type Env } from '../../config/env.js';
import { YouTubeMusicClient } from '../../integrations/youtube-music/youtube-music.client.js';
import type { YouTubeVideo } from '../../integrations/youtube-music/youtube-video.js';
import {
  messageOf,
  TrackProcessingFailure,
} from './track-processing-failure.js';
import {
  chooseSearchMatch,
  isValidCandidate,
  type RecordingTarget,
  recordingTargetOf,
  searchQueryOf,
} from './track-video-matching.js';
import type { PipelineTrack } from './tracks.repository.js';
import { youtubeVideoIdOf } from './youtube-video-id.js';

/** The longest a Recording may be when PROCESSING_MAX_DURATION_SECONDS is unset. */
const PROCESSING_MAX_DURATION_DEFAULT_SECONDS = 900;

/** The video a Processing chose, and where it was found. */
export type ChosenVideo = {
  videoId: string;
  source: TrackProcessingVideoSource;
};

/** The video a finding chose, and the artwork of the best search match. */
export type VideoFinding = {
  video: ChosenVideo;
  /** The artwork of the best search match, or null when it has none. */
  artworkUrl: string | null;
};

type FoundVideo = { video: YouTubeVideo; source: TrackProcessingVideoSource };

/**
 * Finds the YouTube video the timeline will play (ADR 0004): the Recording's
 * own YouTube link when it matches, else the best YouTube Music search result.
 * The length limit is checked before any search, so a Recording too long costs
 * nothing. The search runs even when a link matches, because the candidates
 * are the links and the search, and the search's best match is also where the
 * cover's artwork comes from.
 */
@Injectable()
export class TrackVideoService {
  private readonly logger = new Logger(TrackVideoService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly youtube: YouTubeMusicClient,
  ) {}

  /**
   * @throws {TrackProcessingFailure} `TOO_LONG` when the Recording, or the
   * chosen video of a Recording with no length, is over the limit;
   * `VIDEO_NOT_FOUND` when no candidate matches.
   */
  async findVideo(track: PipelineTrack): Promise<VideoFinding> {
    const target = recordingTargetOf(track);
    if (track.lengthMs !== null) {
      this.assertWithinMaxDuration(track.lengthMs / 1000);
    }
    const linked = await this.findLinkedVideo(target, track.externalUrls);
    const best = await this.searchBestMatch(target, linked !== undefined);
    const found = linked ?? foundBySearch(best);
    if (track.lengthMs === null) {
      this.assertWithinMaxDuration(found.video.durationSeconds);
    }
    return {
      video: { videoId: found.video.videoId, source: found.source },
      artworkUrl: best?.artworkUrl ?? null,
    };
  }

  /** The first of the Recording's YouTube links whose video matches it. */
  private async findLinkedVideo(
    target: RecordingTarget,
    externalUrls: readonly string[],
  ): Promise<FoundVideo | undefined> {
    for (const videoId of youtubeVideoIdsOf(externalUrls)) {
      const video = await this.lookUp(videoId);
      if (video !== undefined && isValidCandidate(target, video)) {
        return { video, source: 'musicbrainz' };
      }
    }
    return undefined;
  }

  /**
   * The best search result. A failed search fails the Processing, unless a
   * link already matched: the link does not depend on the search, so the
   * video is kept and only the artwork is missing.
   */
  private async searchBestMatch(
    target: RecordingTarget,
    hasLink: boolean,
  ): Promise<YouTubeVideo | undefined> {
    try {
      const results = await this.youtube.searchSongs(searchQueryOf(target));
      return chooseSearchMatch(target, results);
    } catch (error) {
      if (!hasLink) {
        throw error;
      }
      this.logger.warn(
        `The YouTube Music search failed, the linked video is kept: ${messageOf(error)}`,
      );
      return undefined;
    }
  }

  /**
   * A linked video that cannot be read is no candidate: the search is still
   * there, so the link is skipped rather than failing the Processing.
   */
  private async lookUp(videoId: string): Promise<YouTubeVideo | undefined> {
    try {
      return await this.youtube.getVideo(videoId);
    } catch (error) {
      this.logger.warn(
        `Could not read the linked YouTube video ${videoId}: ${messageOf(error)}`,
      );
      return undefined;
    }
  }

  private assertWithinMaxDuration(seconds: number | null): void {
    if (seconds !== null && seconds > this.maxDurationSeconds()) {
      throw new TrackProcessingFailure('TOO_LONG');
    }
  }

  private maxDurationSeconds(): number {
    return (
      this.env.PROCESSING_MAX_DURATION_SECONDS ??
      PROCESSING_MAX_DURATION_DEFAULT_SECONDS
    );
  }
}

/** The best search result as the chosen video; no match is a failure. */
function foundBySearch(best: YouTubeVideo | undefined): FoundVideo {
  if (best === undefined) {
    throw new TrackProcessingFailure('VIDEO_NOT_FOUND');
  }
  return { video: best, source: 'youtube_music' };
}

/** The distinct YouTube video IDs the URLs name, in the order given. */
function youtubeVideoIdsOf(urls: readonly string[]): string[] {
  const ids = new Set<string>();
  for (const url of urls) {
    const id = youtubeVideoIdOf(url);
    if (id !== undefined) {
      ids.add(id);
    }
  }
  return [...ids];
}
