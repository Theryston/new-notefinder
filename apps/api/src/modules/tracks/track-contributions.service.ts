import { Injectable } from '@nestjs/common';
import { TrackContributorRepository } from './track-contributor.repository.js';

/**
 * What other modules read about the Contributions a User made. Every kind
 * counts (the create request and the retries of a failed Processing alike).
 */
@Injectable()
export class TrackContributionsService {
  constructor(private readonly contributors: TrackContributorRepository) {}

  /** How many Contributions the User made, across all Tracks and kinds. */
  countOf(userId: string): Promise<number> {
    return this.contributors.countContributionsOf(userId);
  }
}
