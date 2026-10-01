import { sql } from 'drizzle-orm';
import { boolean, check, integer, timestamp } from 'drizzle-orm/pg-core';
import { musicCatalog } from './music-catalog-schema.js';

/**
 * The last MusicBrainz replication packet the mbslave container applied, in
 * `full` mode. mbslave tracks the same number in its own
 * `musicbrainz.replication_control`; this row is our copy of it, so `status`
 * can answer it in every phase without depending on mbslave's tables. No row
 * until the first packet lands (and never one in `sample`, where replication
 * stays off). `updatedAt` tells operators when the sequence last moved, so a
 * stall (the yearly schema change, issue #69) is visible as a frozen
 * sequence next to a growing outbox backlog.
 */
export const replicationState = musicCatalog.table(
  'replication_state',
  {
    // Always true: together with the check below it keeps the table to one row.
    id: boolean().primaryKey().default(true),
    lastSequence: integer().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('replication_state_single_row', sql`${table.id}`)],
);
