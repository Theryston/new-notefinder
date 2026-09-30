import { integer, text, timestamp } from 'drizzle-orm/pg-core';
import { musicCatalog } from './music-catalog-schema.js';

/**
 * How far the worker got indexing a search index: the last Recording it sent
 * to Meilisearch, by MusicBrainz's integer id (the order the worker walks the
 * Recordings in). A worker that restarts mid-indexing continues after it
 * instead of starting over. One row per index; no row means nothing is
 * indexed yet.
 */
export const indexingCheckpoint = musicCatalog.table('indexing_checkpoint', {
  indexUid: text().primaryKey(),
  lastRecordingId: integer().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
