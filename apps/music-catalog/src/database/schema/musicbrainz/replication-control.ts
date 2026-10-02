import { integer, timestamp } from 'drizzle-orm/pg-core';
import { musicbrainz } from './musicbrainz-schema.js';

/**
 * mbslave's replication cursor, written by every replication packet the full
 * dump ships and every packet `mbslave sync` applies (read-only here, like
 * every declaration in this folder: the table belongs to mbslave). Empty in
 * `tiny` mode, which seeds no replication data. Column names and types are
 * mbslave's `CreateTables.sql` at the pinned tag.
 */
export const replicationControl = musicbrainz.table('replication_control', {
  id: integer().notNull(),
  currentSchemaSequence: integer().notNull(),
  // Null until the first packet lands.
  currentReplicationSequence: integer(),
  lastReplicationDate: timestamp({ withTimezone: true }),
});
