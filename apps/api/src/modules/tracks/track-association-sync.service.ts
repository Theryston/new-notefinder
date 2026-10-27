import { Injectable } from '@nestjs/common';
import { TrackAssociationService } from './track-association.service.js';
import { TrackAssociationEventRepository } from './track-association-event.repository.js';
import { TrackAssociationSyncRepository } from './track-association-sync.repository.js';

const PAGE_SIZE = 250;
const WAIT_INTERVAL_MS = 1_000;

/** Rerunnable operator backfill; it waits for catalog acknowledgments per page. */
@Injectable()
export class TrackAssociationSyncService {
  constructor(
    private readonly tracks: TrackAssociationSyncRepository,
    private readonly events: TrackAssociationEventRepository,
    private readonly delivery: TrackAssociationService,
  ) {}

  async synchronize(): Promise<void> {
    let afterId: string | undefined;
    for (;;) {
      const page = await this.tracks.findPage(afterId, PAGE_SIZE);
      if (page.length === 0) break;
      await this.events.enqueueSynchronizationPage(page);
      await this.waitForPage(page.map((track) => track.id));
      afterId = page.at(-1)?.id;
    }
    await this.waitForOutbox();
  }

  private async waitForPage(trackIds: string[]): Promise<void> {
    for (;;) {
      await this.delivery.dispatchPending();
      const pending = await this.events.countPendingForTracks(trackIds);
      if ((pending[0]?.count ?? 0) === 0) return;
      await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
    }
  }

  private async waitForOutbox(): Promise<void> {
    for (;;) {
      await this.delivery.dispatchPending();
      const pending = await this.events.countPending();
      if ((pending[0]?.count ?? 0) === 0) return;
      await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
    }
  }
}
