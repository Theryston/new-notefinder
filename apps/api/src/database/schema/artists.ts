import { index, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';

export const artists = pgTable(
  'artists',
  {
    id: id(),
    name: text().notNull(),
    // YouTube Music channel ID. Not unique: legacy dedupes with
    // check-then-insert (no constraint), so duplicates may exist and every
    // legacy ID must survive the import.
    ytId: text().notNull(),
    ...timestamps,
  },
  (table) => [index().on(table.ytId)],
);
