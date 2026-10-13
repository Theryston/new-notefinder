import { Injectable } from '@nestjs/common';
import type {
  TrackContributor,
  TrackProcessingState,
} from '@notefinder/contracts';
import { type PublicUser, UsersService } from '../users/users.service.js';
import { throwMovedOrMissing } from './track-not-found.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { toTrackProcessing } from './track-processing-view.js';
import { TracksRepository } from './tracks.repository.js';

/**
 * Reads of a Track that its pages share: the state the Processing page shows
 * (the Track header, its latest Processing and its Contributors, which any
 * Track has from the moment it is requested), the Contributors, and the
 * `RESOURCE_MOVED` / `NOT_FOUND` answers for an ID that finds no Track.
 */
@Injectable()
export class TrackProcessingService {
  constructor(
    private readonly tracks: TracksRepository,
    private readonly processings: TrackProcessingRepository,
    private readonly users: UsersService,
  ) {}

  /**
   * A legacy Track ID answers `RESOURCE_MOVED` with its new ID, so the web
   * redirects; an unknown ID is a real `NOT_FOUND`. Reads never touch the Music
   * catalog.
   */
  async getProcessingState(trackId: string): Promise<TrackProcessingState> {
    const header = await this.tracks.findTrackHeader(trackId);
    if (header === undefined) {
      return this.throwMovedOrMissing(trackId);
    }
    const [latest, contributors] = await Promise.all([
      this.processings.findLatestProcessing(trackId),
      this.contributorsOf(trackId),
    ]);
    return {
      track: header,
      processing: latest === undefined ? null : toTrackProcessing(latest),
      contributors,
    };
  }

  /**
   * The Track's Contributors in the order they first contributed. One whose
   * User has no public profile is left out.
   */
  async contributorsOf(trackId: string): Promise<TrackContributor[]> {
    const contributors = await this.processings.findContributors(trackId);
    const profiles = await this.users.findPublicUsers(
      contributors.map((contributor) => contributor.userId),
    );
    return contributors.flatMap((contributor) => {
      const profile = profiles.get(contributor.userId);
      return profile === undefined
        ? []
        : [toContributor(contributor.id, profile)];
    });
  }

  /**
   * Answers the same `RESOURCE_MOVED` or `NOT_FOUND` as the read, for a write
   * that needs the Track to exist (a retry).
   */
  async assertTrackExists(trackId: string): Promise<void> {
    const header = await this.tracks.findTrackHeader(trackId);
    if (header === undefined) {
      await this.throwMovedOrMissing(trackId);
    }
  }

  /** See {@link throwMovedOrMissing}. */
  throwMovedOrMissing(trackId: string): Promise<never> {
    return throwMovedOrMissing(this.tracks, trackId);
  }
}

/** The Contributor as the page shows it: the link, the name and the Avatar. */
function toContributor(id: string, profile: PublicUser): TrackContributor {
  return {
    id,
    username: profile.username,
    name: profile.name,
    image: profile.image,
  };
}
