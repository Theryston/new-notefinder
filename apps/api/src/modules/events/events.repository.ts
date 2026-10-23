import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, gte, lt, or, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { events } from '../../database/schema/events.js';
import type { StoreEventsJob } from './events.job.js';

export type PinEventWindow = {
  rowId: string;
  startsAt: Date;
  endsAt: Date;
};

export type PinEventCounts = {
  rowId: string;
  impressions: number;
  clicks: number;
};

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

  /** Counts only persisted events for each pin row in the pin's live window. */
  async countPinEvents(windows: PinEventWindow[]): Promise<PinEventCounts[]> {
    if (windows.length === 0) {
      return [];
    }
    const windowFilters = windows.map(({ rowId, startsAt, endsAt }) =>
      and(
        eq(events.rowId, rowId),
        gte(events.createdAt, startsAt),
        lt(events.createdAt, endsAt),
      ),
    );
    return this.txHost.tx
      .select({
        rowId: events.rowId,
        impressions:
          sql<number>`count(*) filter (where ${events.type} = 'home.row_impression')::int`.mapWith(
            Number,
          ),
        clicks:
          sql<number>`count(*) filter (where ${events.type} = 'home.item_click')::int`.mapWith(
            Number,
          ),
      })
      .from(events)
      .where(or(...windowFilters))
      .groupBy(events.rowId)
      .then((rows) =>
        rows.flatMap((row) =>
          row.rowId === null ? [] : [{ ...row, rowId: row.rowId }],
        ),
      );
  }
}
