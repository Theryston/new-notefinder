import { index, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { tracks } from './tracks.js';
import { users } from './users.js';

/**
 * A Track a User marked as a favorite: one row per (User, Track).
 *
 * Legacy mapping: a legacy favorite is (userId, trackId) with the legacy
 * Track ID. The import keeps the user ID, translates the Track ID through
 * `legacy_track_ids` (several legacy IDs may land on one Track, so the unique
 * pair makes the import idempotent: insert with `on conflict do nothing`) and
 * drops the favorites whose Track has no new equivalent, listing them in the
 * import report. `createdAt` takes the legacy favorite's date when it has one.
 */
export const trackFavorites = pgTable(
  'track_favorites',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    unique('track_favorites_user_track_unique').on(table.userId, table.trackId),
    // The favorites of a Track (counts, cleanup) are a lookup of their own.
    index().on(table.trackId),
  ],
);
