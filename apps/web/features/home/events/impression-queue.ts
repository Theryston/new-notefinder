import type { HomeRowImpressionEvent } from '@notefinder/contracts';

export type QueuedImpression = Omit<HomeRowImpressionEvent, 'type'>;

/**
 * The impressions seen on this page load, flushed in batches. A row counts
 * once per page load: sightings after the first are ignored, even across
 * flushes.
 */
export class HomeImpressionQueue {
  private readonly seen = new Set<string>();
  private pending: HomeRowImpressionEvent[] = [];

  /**
   * Queues the row's impression unless the row was already seen. Answers
   * whether the impression was queued.
   */
  record(impression: QueuedImpression): boolean {
    if (this.seen.has(impression.rowId)) return false;
    this.seen.add(impression.rowId);
    this.pending.push({ type: 'home.row_impression', ...impression });
    return true;
  }

  /** Whether a batch is waiting to be sent. */
  get isEmpty(): boolean {
    return this.pending.length === 0;
  }

  /** Takes the waiting impressions, leaving the queue empty. */
  takeBatch(): HomeRowImpressionEvent[] {
    const batch = this.pending;
    this.pending = [];
    return batch;
  }
}
