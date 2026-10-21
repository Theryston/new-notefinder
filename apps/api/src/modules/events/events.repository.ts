import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { DatabaseAdapter } from '../../database/database.js';
import { events } from '../../database/schema/events.js';
import type { StoreEventsJob } from './events.job.js';

/** Raw engagement events, stored exactly as the queue carried them. */
@Injectable()
export class EventsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * Stores the whole batch with a single `INSERT`, never one insert per
   * event. An empty batch stores nothing.
   */
  async insertMany(rows: StoreEventsJob): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }
    await this.txHost.tx.insert(events).values(rows);
    return rows.length;
  }
}
