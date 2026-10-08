import { Injectable } from '@nestjs/common';
import type {
  TrackContributor,
  TrackProcessingState,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import type { PublicUserRow } from '../users/users.repository.js';
import { UsersService } from '../users/users.service.js';
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
    const [artists, latest, contributorIds] = await Promise.all([
      this.tracks.findTrackArtists(trackId),
      this.processings.findLatestProcessing(trackId),
      this.processings.findContributorUserIds(trackId),
    ]);
    const profiles = await this.users.findPublicUsers(contributorIds);
    return {
      track: { ...header, artists },
      processing: latest === undefined ? null : toTrackProcessing(latest),
      contributors: contributorIds.flatMap((userId) => {
        const profile = profiles.get(userId);
        return profile === undefined ? [] : [toContributor(profile)];
      }),
    };
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
function toContributor(profile: PublicUserRow): TrackContributor {
  return {
    username: profile.username,
    name: profile.name,
    image: profile.image,
  };
}
