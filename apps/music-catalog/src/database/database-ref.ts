import type { Logger } from '../logger.js';
import type { Database } from './database.js';
import { createDatabase, createPool } from './database.js';

/**
 * Where a repository reads and writes: either the database itself or a
 * provider returning the current one. The provider is what lets a process
 * flip from the serving copy to the reimported copy without restarting
 * (issue #69): repositories resolve it on every query, so in-flight
 * requests finish on the old copy while new ones use the new one. Passing
 * the database stays equivalent to passing `() => db`.
 */
export type DatabaseSource = Database | (() => Database);

/**
 * The database a connection URL points at (`postgres://host/name` gives
 * `name`), or undefined when the URL names none. The reimport drops the
 * retired database by this name.
 */
export const databaseNameOf = (url: string): string | undefined => {
  const name = new URL(url).pathname.replace(/^\//, '');
  return name === '' ? undefined : name;
};

/**
 * Opens a database for the cutover watcher. Kept beside the reference it
 * feeds (not a module): it owns pools, which no feature does. The caller
 * owns the pool: adoption happens once per process, and the retired pool
 * dies with the dropped database or the process.
 */
export const openCutoverDatabase = (url: string, logger: Logger): Database => {
  const pool = createPool(url, (error) => {
    logger.error('Database connection error', { error });
  });
  return createDatabase(pool);
};
