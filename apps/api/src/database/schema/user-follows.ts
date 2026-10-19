import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { users } from './users.js';

/**
 * A User following another User: one row per (follower, followed). Friends
 * (mutual follows) are never stored; they are read from these rows.
 *
 * Legacy mapping: the legacy app has no follows, so the import creates none.
 * A User cannot follow themselves, and the check says so for every writer.
 */
export const userFollows = pgTable(
  'user_follows',
  {
    id: id(),
    followerId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    unique('user_follows_follower_following_unique').on(
      table.followerId,
      table.followingId,
    ),
    // The followers of a User (and the cascade from deleting it) start here;
    // the unique pair above only serves lookups that start with the follower.
    index().on(table.followingId),
    check(
      'user_follows_not_self',
      sql`${table.followerId} <> ${table.followingId}`,
    ),
  ],
);
