import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export type Database = NodePgDatabase;

/**
 * `onError` is required because an idle connection that dies (the database
 * restarts, a network cut) makes the pool emit `error`, which crashes the
 * process when nothing listens. The pool replaces the connection on the next
 * query, so reporting it is all that is needed.
 */
export const createPool = (
  connectionString: string,
  onError: (error: Error) => void,
): Pool => new Pool({ connectionString }).on('error', onError);

// `casing` must match drizzle.config.ts so queries use the snake_case columns
// the migrations created.
export const createDatabase = (pool: Pool): Database =>
  drizzle({ client: pool, casing: 'snake_case' });
