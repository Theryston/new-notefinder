import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { HomeEvent } from '@vozzify/contracts';
import type { Queue } from 'bullmq';
import type { StoredEvent } from './events.job.js';
import {
  EVENTS_QUEUE,
  STORE_EVENTS_JOB,
  type StoreEventsJob,
} from './events.job.js';
import { isBotUserAgent } from './events-bots.js';

/** What `record` stores with each event of the batch. */
export type RecordEvents = {
  visitorId: string;
  userId: string | undefined;
  userAgent: string | undefined;
  events: HomeEvent[];
};

/** One contract event as the `events` row (plus its raw payload). */
const toRow = (
  event: HomeEvent,
  visitorId: string,
  userId: string | undefined,
): StoredEvent => {
  const shared = {
    visitorId,
    userId: userId ?? null,
    type: event.type,
    rowId: event.rowId,
    feedVersion: event.feedVersion,
    algorithmVersion: event.algorithmVersion,
    payload: event,
  };
  return event.type === 'home.row_impression'
    ? { ...shared, itemId: null, position: null }
    : {
        ...shared,
        itemId: event.itemId,
        position: event.position ?? null,
        ...(event.clickId === undefined ? {} : { clickId: event.clickId }),
      };
};

/**
 * Engagement events: the endpoint buffers them in Redis and answers at once;
 * the processor stores them. Bot traffic is dropped after the 202, so the
 * table only holds real visits.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectQueue(EVENTS_QUEUE) private readonly queue: Queue<StoreEventsJob>,
  ) {}

  /**
   * Queues the batch for storing and reports how many of it was accepted. A
   * bot batch is dropped: accepted 0, nothing queued.
   */
  async record(options: RecordEvents): Promise<{ accepted: number }> {
    const { visitorId, userId, userAgent, events } = options;
    if (isBotUserAgent(userAgent)) {
      this.logger.debug('Dropping an events batch from a bot user agent');
      return { accepted: 0 };
    }
    const rows = events.map((event) => toRow(event, visitorId, userId));
    await this.queue.add(STORE_EVENTS_JOB, rows, {
      // Completed batches leave Redis at once (high volume); failures follow
      // the queue convention (`QueueModule` retries 5 times, then keeps the
      // job), so a transient database failure stays visible instead of lost.
      removeOnComplete: true,
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
    });
    return { accepted: rows.length };
  }
}
