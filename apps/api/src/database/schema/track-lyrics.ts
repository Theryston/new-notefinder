import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { tracks } from './tracks.js';

/**
 * One line of a Track's Timed lyrics (CONTEXT.md "Timed lyrics"), as the
 * transcription's segments give it. The Processing that transcribes the lyrics
 * replaces all of the Track's lines and words at once; they are never edited one
 * by one. A line is read with its words in one relational query.
 */
export const trackLyricLines = pgTable(
  'track_lyric_lines',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    /** The line's place in the Track, counted from 0. */
    position: integer().notNull(),
    /** Seconds from the start of the Track. */
    start: doublePrecision().notNull(),
    end: doublePrecision().notNull(),
    ...timestamps,
  },
  // The Track's lines in the order they are sung; its leading column indexes them.
  (table) => [
    unique('track_lyric_lines_position_unique').on(
      table.trackId,
      table.position,
    ),
  ],
);

/**
 * One word of a Track's Timed lyrics, timed to the Track's audio. The Track is
 * denormalized onto the word, so its words are found without going through
 * their lines.
 */
export const trackLyricWords = pgTable(
  'track_lyric_words',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    lineId: text()
      .notNull()
      .references(() => trackLyricLines.id, { onDelete: 'cascade' }),
    /** The word's place in its line, counted from 0. */
    position: integer().notNull(),
    text: text().notNull(),
    /** Seconds from the start of the Track. */
    start: doublePrecision().notNull(),
    end: doublePrecision().notNull(),
    ...timestamps,
  },
  (table) => [
    index().on(table.trackId),
    unique('track_lyric_words_line_position_unique').on(
      table.lineId,
      table.position,
    ),
  ],
);
