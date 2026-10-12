import { Injectable, Logger } from '@nestjs/common';
import { cacheTags } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TrackContributorPagesRepository } from './track-contributor-pages.repository.js';

/**
 * Keeps the Track pages current when a Contributor's Name or Avatar changes:
 * a Track page shows its Contributors, and it is cached until its tag is
 * revalidated. It lives in a module of its own so the Users module can call it
 * without a cycle (the Tracks module already uses the Users module).
 */
@Injectable()
export class TrackContributorPagesService {
  private readonly logger = new Logger(TrackContributorPagesService.name);

  constructor(
    private readonly pages: TrackContributorPagesRepository,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  /**
   * Best effort, like the Profile's: the change is already saved, so a queue
   * or a read that fails must not turn it into an error.
   */
  async revalidateTracksOf(userId: string): Promise<void> {
    try {
      const trackIds = await this.pages.findTrackIdsOf(userId);
      if (trackIds.length > 0) {
        await this.webRevalidation.revalidate(
          trackIds.map((trackId) => cacheTags.track(trackId)),
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not enqueue the Track pages revalidation: ${reason}`,
      );
    }
  }
}
