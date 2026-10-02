import { CATALOG_DATASETS } from '@notefinder/contracts';
import { sql } from 'drizzle-orm';
import type { Database } from './database.js';

/**
 * Refuses a catalog bootstrapped on a dataset the service no longer lays
 * down. The `catalog_dataset` enum migration recasts the column, so without
 * this a `db:migrate` on such a database dies with a raw cast error; this
 * fails first with where to go instead. There is no mapping of old rows:
 * switching datasets always means resetting the database (see
 * apps/music-catalog/AGENTS.md "Resetting a local database").
 */
export const assertSupportedDatasets = (datasets: readonly string[]): void => {
  const removed = datasets.filter(
    (dataset) => !(CATALOG_DATASETS as readonly string[]).includes(dataset),
  );
  if (removed.length > 0) {
    throw new Error(
      `The catalog holds the removed ${removed.join(', ')} dataset: reset ` +
        'the local database first (see apps/music-catalog/AGENTS.md ' +
        '"Resetting a local database"). The sample dump was dropped by ' +
        `#85; datasets are now ${CATALOG_DATASETS.join(' and ')}.`,
    );
  }
};

const isUndefinedTable = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  // Drizzle wraps the driver's error (`DrizzleQueryError`), so the Postgres
  // code lives on the cause, not on what `db.execute` throws.
  if ('code' in error && error.code === '42P01') {
    return true;
  }
  return 'cause' in error && isUndefinedTable(error.cause);
};

/**
 * The datasets the recorded bootstrap rows name, as plain text (the column
 * type may still be the old enum). Empty on a fresh database, where the
 * bootstrap table arrives with the migrations below.
 */
export const readRecordedDatasets = async (db: Database): Promise<string[]> => {
  try {
    const rows = await db.execute<{ dataset: string }>(
      sql`select dataset::text as dataset from music_catalog.bootstrap_state`,
    );
    return rows.rows.map((row) => row.dataset);
  } catch (error) {
    if (isUndefinedTable(error)) {
      return [];
    }
    throw error;
  }
};
