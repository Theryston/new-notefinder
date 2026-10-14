import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { id } from '../columns.js';
import { tracks } from './tracks.js';
import { users } from './users.js';

/** A browser-session view. Legacy Track IDs resolve through legacy_track_ids. */
export const trackViews = pgTable(
  'track_views',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    userId: text().references(() => users.id, { onDelete: 'set null' }),
    viewedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.trackId, table.viewedAt)],
);
