import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { trackViews } from './track-views.js';
import { users } from './users.js';

/**
 * A credited slice of practice, attributed to the Track page that produced it.
 * The legacy app did not store heartbeat events, so there are no imported rows.
 */
export const practiceHeartbeats = pgTable('practice_heartbeats', {
  id: id(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  viewId: text().references(() => trackViews.id, { onDelete: 'set null' }),
  elapsedSeconds: integer().notNull(),
  creditedSeconds: integer().notNull(),
  ...timestamps,
});

export type PracticeHeartbeatRow = typeof practiceHeartbeats.$inferSelect;
