import { index, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';

export const albums = pgTable(
  'albums',
  {
    id: id(),
    name: text().notNull(),
    // YouTube Music browse ID. Not unique for the same reason as
    // `artists.ytId`.
    ytId: text().notNull(),
    ...timestamps,
  },
  (table) => [index().on(table.ytId)],
);
