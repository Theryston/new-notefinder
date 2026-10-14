import { doublePrecision, index, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { tracks } from './tracks.js';

/**
 * One Vocal note of a Track (CONTEXT.md), as the note detection of a
 * completed Processing found it. The Processing that completes a Track replaces
 * all of its notes at once; they are never edited one by one.
 */
export const trackNotes = pgTable(
  'track_notes',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    /** A MIDI number (A4 is 69), possibly between two keys. */
    pitch: doublePrecision().notNull(),
    /** Seconds from the start of the Track. */
    start: doublePrecision().notNull(),
    end: doublePrecision().notNull(),
    ...timestamps,
  },
  // The notes of a Track in the order they are sung: the timeline reads them so.
  (table) => [index().on(table.trackId, table.start)],
);
