import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TrackProcessingVideoSource } from '@notefinder/contracts';
import { ENV, type Env } from '../../config/env.js';
import { YouTubeMusicClient } from '../../integrations/youtube-music/youtube-music.client.js';
import type { YouTubeVideo } from '../../integrations/youtube-music/youtube-video.js';
import { TrackProcessingFailure } from './track-processing-failure.js';
import {
  chooseSearchMatch,
  isValidCandidate,
  type RecordingTarget,
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

type FoundVideo = { video: YouTubeVideo; source: TrackProcessingVideoSource };

/** What a Track's Recording is matched against. */
export const recordingTargetOf = (track: PipelineTrack): RecordingTarget => ({
  title: track.title,
  lengthMs: track.lengthMs,
  artistNames: track.artistNames,
});

/**
 * Finds the YouTube video the timeline will play (ADR 0004): the Recording's
 * own YouTube link when it matches, else the best YouTube Music search result.
 * The length limit is checked before any search, so a Recording too long costs
 * nothing.
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
  async findVideo(track: PipelineTrack): Promise<ChosenVideo> {
    const target = recordingTargetOf(track);
    if (track.lengthMs !== null) {
      this.assertWithinMaxDuration(track.lengthMs / 1000);
    }
    const found =
      (await this.findLinkedVideo(target, track.externalUrls)) ??
      (await this.findSearchedVideo(target));
    if (track.lengthMs === null) {
      this.assertWithinMaxDuration(found.video.durationSeconds);
    }
    return { videoId: found.video.videoId, source: found.source };
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

  /** The best search result; a missing video is a failure, not a retry. */
  private async findSearchedVideo(
    target: RecordingTarget,
  ): Promise<FoundVideo> {
    const results = await this.youtube.searchSongs(searchQueryOf(target));
    const best = chooseSearchMatch(target, results);
    if (best === undefined) {
      throw new TrackProcessingFailure('VIDEO_NOT_FOUND');
    }
    return { video: best, source: 'youtube_music' };
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
