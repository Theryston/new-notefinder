import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import type { Database } from './database.js';

type TimeoutTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Applies a local PostgreSQL timeout to only the work inside this transaction. */
export const withStatementTimeout = <Result>(
  db: Database,
  timeoutMs: number,
  query: (transaction: TimeoutTransaction) => Promise<Result>,
): Promise<Result> => runWithBoundedPool(db, timeoutMs, query);

const runWithBoundedPool = async <Result>(
  db: Database,
  timeoutMs: number,
  query: (transaction: TimeoutTransaction) => Promise<Result>,
): Promise<Result> => {
  const sourcePool = (db as Database & { $client: Pool }).$client;
  // Leave time for PostgreSQL to return its cancellation response before the
  // client-side deadline expires.
  const statementTimeoutMs = Math.max(
    1,
    timeoutMs - Math.min(250, timeoutMs / 10),
  );
  const pool = new Pool({
    ...sourcePool.options,
    connectionTimeoutMillis: timeoutMs,
    query_timeout: timeoutMs,
    statement_timeout: statementTimeoutMs,
    max: 1,
  });
  let client: PoolClient | undefined;
  let discardClient = false;

  try {
    client = await pool.connect();
    const boundedDatabase = drizzle({ client, casing: 'snake_case' });
    return await boundedDatabase.transaction(async (transaction) => {
      await transaction.execute(
        sql`select set_config('statement_timeout', ${`${statementTimeoutMs}ms`}, true)`,
      );
      return query(transaction);
    });
  } catch (error) {
    discardClient = true;
    throw error;
  } finally {
    if (client !== undefined) {
      client.release(discardClient);
    }
    await pool.end();
  }
};
