import { index, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { trackProcessings } from './track-processings.js';
import { tracks } from './tracks.js';
import { users } from './users.js';

// `CREATE` is the request that made the Track; `RETRY` a retry of a failed
// Processing. Editing kinds arrive with their features.
export const trackContributionKind = pgEnum('track_contribution_kind', [
  'CREATE',
  'RETRY',
]);

/**
 * A User who has done at least one Contribution to a Track (CONTEXT.md
 * "Contributor"): one row per (Track, User), however many Contributions.
 */
export const trackContributors = pgTable(
  'track_contributors',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    unique('track_contributors_track_user_unique').on(
      table.trackId,
      table.userId,
    ),
    // A User's Tracks, and the Contributors of a Track, are both lookups.
    index().on(table.userId),
  ],
);

/**
 * One action a Contributor did on a Track, with the Processing it started
 * (CONTEXT.md "Contribution"). Every action is a new row, so the Track keeps
 * who did what and when.
 */
export const trackContributions = pgTable(
  'track_contributions',
  {
    id: id(),
    contributorId: text()
      .notNull()
      .references(() => trackContributors.id, { onDelete: 'cascade' }),
    kind: trackContributionKind().notNull(),
    processingId: text()
      .notNull()
      .references(() => trackProcessings.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  // The active Processings of a User join through their Contributions.
  (table) => [index().on(table.contributorId), index().on(table.processingId)],
);
