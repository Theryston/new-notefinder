import type { Database } from '../../src/database/database.js';
import { trackContributors } from '../../src/database/schema/track-contributors.js';
import { trackProcessings } from '../../src/database/schema/track-processings.js';
import { legacyTrackIds } from '../../src/database/schema/tracks.js';

export type TrackProcessingRow = typeof trackProcessings.$inferSelect;
export type TrackContributorRow = typeof trackContributors.$inferSelect;

type NewProcessing = typeof trackProcessings.$inferInsert;

const insertOne = async <T>(rows: Promise<T[]>): Promise<T> => {
  const [row] = await rows;
  if (row === undefined) {
    throw new Error('Insert returned no row');
  }
  return row;
};

/** A queued Processing of a Track, unless the overrides say otherwise. */
export const createTrackProcessing = (
  db: Database,
  trackId: string,
  overrides: Partial<NewProcessing> = {},
): Promise<TrackProcessingRow> =>
  insertOne(
    db
      .insert(trackProcessings)
      .values({ trackId, ...overrides })
      .returning(),
  );

/** A User as a Contributor of a Track. */
export const createTrackContributor = (
  db: Database,
  trackId: string,
  userId: string,
): Promise<TrackContributorRow> =>
  insertOne(
    db.insert(trackContributors).values({ trackId, userId }).returning(),
  );

/** A legacy Track ID pointing at a Track, for the redirect path. */
export const createLegacyTrackId = (
  db: Database,
  trackId: string,
  legacyId: string,
): Promise<void> =>
  insertOne(
    db.insert(legacyTrackIds).values({ legacyId, trackId }).returning(),
  ).then(() => undefined);
