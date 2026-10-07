import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';

/**
 * Track catalog row with its core display columns: what the artist page
 * table scans (title, duration, ISRCs, genres) plus the disambiguation and
 * video flag that tell takes apart. The deeper MusicBrainz sections
 * (releases, works, tags, links) live in companion tables in a later slice.
 * Starts empty: every search hit is unlinked until data is processed. One
 * Track per Recording (Recordings are never grouped).
 */
export const tracks = pgTable(
  'tracks',
  {
    id: id(),
    // The MBID of the MusicBrainz Recording, the only identity of a Track's
    // source. Unique, so the API can decide linked versus static per hit.
    recordingMbid: text().notNull(),
    // Display title, as the track table shows it. No default: the
    // contract requires a non-empty title, so a missing one must fail at
    // insert time, never as a 500 at read time.
    title: text().notNull(),
    // In milliseconds; null when MusicBrainz has none.
    lengthMs: integer(),
    // Tells apart Recordings with the same title and artist; '' when none.
    disambiguation: text().notNull().default(''),
    // Whether the Recording is a video.
    video: boolean().notNull().default(false),
    isrcs: text().array().notNull().default([]),
    // Display genres, most relevant first; empty when unknown.
    genres: text().array().notNull().default([]),
    ...timestamps,
  },
  (table) => [unique('tracks_recording_mbid_unique').on(table.recordingMbid)],
);

/**
 * Legacy ID map of the tracks table (see
 * `docs/adr/0001-reprocessed-catalog-with-legacy-id-maps.md`). Several
 * legacy IDs may point to one Track (legacy has duplicates).
 */
export const legacyTrackIds = pgTable(
  'legacy_track_ids',
  {
    legacyId: text().primaryKey(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
  },
  (table) => [index().on(table.trackId)],
);
