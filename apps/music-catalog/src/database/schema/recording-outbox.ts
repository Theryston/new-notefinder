import { integer, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { musicCatalog } from './music-catalog-schema.js';

/**
 * Recordings whose search document may be out of date: every change to a
 * MusicBrainz table that feeds a Recording's document writes its id here
 * (from a trigger the worker installs, see `modules/sync/`), and the worker
 * drains the entries in batches, rebuilding each Recording's document or
 * deleting it from the index. Entries are never removed, only marked
 * `processedAt`, so a worker that dies mid-batch reprocesses what is left.
 */
export const recordingOutbox = musicCatalog.table(
  'recording_outbox',
  {
    /** MusicBrainz's integer id of the Recording. */
    recordingId: integer().notNull(),
    /** The MBID the Recording had when the change was written. */
    recordingMbid: uuid().notNull(),
    enqueuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Null while the change still waits to reach the index. */
    processedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.recordingId, table.recordingMbid] }),
  ],
);
