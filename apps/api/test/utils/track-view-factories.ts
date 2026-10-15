import type { Database } from '../../src/database/database.js';
import { trackViews } from '../../src/database/schema/track-views.js';

type NewTrackView = typeof trackViews.$inferInsert;
export type TrackViewRow = typeof trackViews.$inferSelect;

/** One view of a Track: by a visitor, unless `userId` is given. */
export const createTrackView = async (
  db: Database,
  trackId: string,
  overrides: Partial<NewTrackView> = {},
): Promise<TrackViewRow> => {
  const [row] = await db
    .insert(trackViews)
    .values({ trackId, ...overrides })
    .returning();
  if (row === undefined) {
    throw new Error('Insert returned no row');
  }
  return row;
};
