import { sql } from 'drizzle-orm';
import type { Database } from './database.js';

type TimeoutTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Applies a local PostgreSQL timeout to only the work inside this transaction. */
export const withStatementTimeout = <Result>(
  db: Database,
  timeoutMs: number,
  query: (transaction: TimeoutTransaction) => Promise<Result>,
): Promise<Result> =>
  db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select set_config('statement_timeout', ${`${timeoutMs}ms`}, true)`,
    );
    return query(transaction);
  });
