import { index, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';

/**
 * Minimal Track catalog slice: the new primary id plus the MusicBrainz
 * recording reference it was processed from. Starts empty: every search hit
 * is unlinked until data is processed. One Track per Recording (Recordings
 * are never grouped).
 */
export const tracks = pgTable(
  'tracks',
  {
    id: id(),
    // The MBID of the MusicBrainz Recording, the only identity of a Track's
    // source. Unique, so the API can decide linked versus static per hit.
    recordingMbid: text().notNull(),
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
