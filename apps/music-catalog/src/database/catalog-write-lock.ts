import { sql } from 'drizzle-orm';
import type { Database } from './database.js';

// A database-wide fence keeps metadata replacement and association delivery
// ordered, and lets reimport cutover close admission before transferring state.
const CATALOG_WRITE_LOCK = 385_001;

export const withCatalogWriteLock = <Result>(
  db: Database,
  run: (
    transaction: Parameters<Parameters<Database['transaction']>[0]>[0],
  ) => Promise<Result>,
): Promise<Result> =>
  db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(${CATALOG_WRITE_LOCK})`,
    );
    return run(transaction);
  });

export const acquireCatalogWriteLock = async (
  transaction: Parameters<Parameters<Database['transaction']>[0]>[0],
): Promise<void> => {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(${CATALOG_WRITE_LOCK})`,
  );
};
