import { createId } from '@paralleldrive/cuid2';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.js';
import { users } from './users.js';

/**
 * Raw engagement events (`POST /v1/events`), stored as they arrived for later
 * analysis. One row per event; the owning request's batch becomes one `INSERT`.
 * `userId` is set when the batch was signed in, otherwise only `visitorId`
 * (the browser's local-storage id, no cookie) identifies the visitor.
 * `payload` keeps the whole event, so new event types need no new columns.
 *
 * The table is partitioned by month on `createdAt` (see the migration and
 * `docs/adr/0013-events-and-acquisition.md`): every insert lands in the
 * current month's partition, and a new partition is created ahead of each
 * month (the migration documents how). Nothing is ever deleted in this slice.
 *
 * The primary key covers `(id, createdAt)`: Postgres only allows uniqueness
 * on a partitioned table when the partition key is part of it. Legacy import:
 * nothing to import, the legacy app recorded no such events.
 */
export const events = pgTable(
  'events',
  {
    // No single-column primary key: a partitioned table only allows
    // uniqueness when the partition key (`createdAt`) is part of it.
    id: text()
      .notNull()
      .$defaultFn(() => createId()),
    visitorId: text().notNull(),
    userId: text().references(() => users.id, { onDelete: 'set null' }),
    /** The event's `type` (e.g. `home.row_impression`); mirrors the payload. */
    type: text().notNull(),
    rowId: text(),
    feedVersion: text(),
    algorithmVersion: integer(),
    itemId: text(),
    position: integer(),
    clickId: text(),
    payload: jsonb().notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.id, table.createdAt] }),
    index().on(table.createdAt),
    index().on(table.userId),
    index().on(table.visitorId, table.createdAt),
  ],
);

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
