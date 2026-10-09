import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { tracks } from './tracks.js';

/**
 * One vocal note of a Track (CONTEXT.md "Track"), as the note detection of a
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
    /** The pitch class name, `C` to `B`, sharps as `#` (`A#`). */
    note: text().notNull(),
    /** The octave of the note in MIDI numbering (`A4` is 4). */
    octave: integer().notNull(),
    /** Seconds from the start of the Track. */
    start: doublePrecision().notNull(),
    end: doublePrecision().notNull(),
    /** The mean frequency of the note, in Hz. */
    frequencyMean: doublePrecision().notNull(),
    ...timestamps,
  },
  // The notes of a Track in the order they are sung: the timeline reads them so.
  (table) => [index().on(table.trackId, table.start)],
);
