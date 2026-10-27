import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { tracks } from './tracks.js';

/** Durable outbox rows for projecting newly created Tracks into the Music catalog. */
export const trackAssociationEvents = pgTable(
  'track_association_events',
  {
    id: id(),
    recordingMbid: text().notNull(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    claimedUntil: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('track_association_events_pending_idx')
      .on(table.nextAttemptAt, table.createdAt)
      .where(sql`${table.deliveredAt} is null`),
    index('track_association_events_delivered_idx')
      .on(table.deliveredAt)
      .where(sql`${table.deliveredAt} is not null`),
  ],
);
