import { Injectable, Logger } from '@nestjs/common';
import { cacheTags } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TrackCoverService } from './track-cover.service.js';

/**
 * The cover job (ADR 0004): stores a Track's cover, then refreshes the Track's
 * pages. The refresh runs after every successful pass, not only after a store,
 * so a replay whose refresh failed still refreshes. A failure is retried; on
 * the last attempt the Track keeps its placeholder, which only a log line
 * records.
 */
@Injectable()
export class TrackCoverJob {
  private readonly logger = new Logger(TrackCoverJob.name);

  constructor(
    private readonly covers: TrackCoverService,
    private readonly revalidation: WebRevalidationService,
  ) {}

  async run(trackId: string, finalAttempt: boolean): Promise<void> {
    try {
      await this.covers.storeCover(trackId);
      await this.revalidation.revalidate([
        cacheTags.track(trackId),
        cacheTags.tracks,
      ]);
    } catch (error) {
      if (!finalAttempt) {
        throw error;
      }
      this.logger.warn(`No cover for Track ${trackId}: ${messageOf(error)}`);
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
