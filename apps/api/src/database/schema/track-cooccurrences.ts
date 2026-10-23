import { index, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { tracks } from './tracks.js';

/** Batch-computed count of distinct singers shared by a Track pair. */
export const trackCooccurrences = pgTable(
  'track_cooccurrences',
  {
    sourceTrackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    targetTrackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    singerCount: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceTrackId, table.targetTrackId] }),
    index().on(table.sourceTrackId, table.singerCount),
  ],
);
