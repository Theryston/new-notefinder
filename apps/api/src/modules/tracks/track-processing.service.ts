import { Injectable } from '@nestjs/common';
import type {
  TrackContributor,
  TrackProcessingState,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { type PublicUser, UsersService } from '../users/users.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { toTrackProcessing } from './track-processing-view.js';
import { TracksRepository } from './tracks.repository.js';

/**
 * The state the Processing page shows: the Track header, its latest Processing
 * and its Contributors. Any Track has it, whatever its Processing, so the page
 * works from the moment a Track is requested.
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
      this.processings.findContributors(trackId),
    ]);
    const profiles = await this.users.findPublicUsers(
      contributors.map((contributor) => contributor.userId),
    );
    return {
      track: header,
      processing: latest === undefined ? null : toTrackProcessing(latest),
      contributors: contributors.flatMap((contributor) => {
        const profile = profiles.get(contributor.userId);
        return profile === undefined
          ? []
          : [toContributor(contributor.id, profile)];
      }),
    };
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

  private async throwMovedOrMissing(trackId: string): Promise<never> {
    const newId = await this.tracks.findTrackIdByLegacyId(trackId);
    if (newId !== undefined) {
      throw new AppException('RESOURCE_MOVED', 'Track moved', { id: newId });
    }
    throw new AppException('NOT_FOUND', 'Track not found');
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
