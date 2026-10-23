import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { tracks } from './tracks.js';

/** Batch-computed count of distinct singers shared by a Track pair. */
export const trackCooccurrences = pgTable(
  'track_cooccurrences',
  {
    id: id(),
    sourceTrackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    targetTrackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    singerCount: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    index().on(table.sourceTrackId, table.singerCount),
    uniqueIndex().on(table.sourceTrackId, table.targetTrackId),
  ],
);
