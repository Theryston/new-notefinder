import { text, timestamp } from 'drizzle-orm/pg-core';
import { musicCatalog } from './music-catalog-schema.js';

/**
 * The Lyrics matched to a Recording from the LRCLIB dump, keyed by the
 * Recording's MBID (the same key the `lyrics` search index uses). Only
 * Lyrics of a confident match are kept: a Recording without one has no row.
 */
export const recordingLyrics = musicCatalog.table('recording_lyrics', {
  mbid: text('mbid').primaryKey(),
  plainLyrics: text('plain_lyrics'),
  syncedLyrics: text('synced_lyrics'),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
