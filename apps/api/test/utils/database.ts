import { sql } from 'drizzle-orm';
import { inject } from 'vitest';
import {
  createDatabase,
  createPool,
  type Database,
} from '../../src/database/database.js';
import { resetFactorySequences } from './factories.js';

// Drizzle keeps it in its own `drizzle` schema by default; excluded by name
// too in case a future config moves it to `public`.
const MIGRATIONS_TABLE = '__drizzle_migrations';

/**
 * Empties every application table (discovered from the database, so new
 * tables are covered without touching this helper) and restarts the factory
 * sequences. Call it in `beforeEach` of specs that write to the database.
 */
export const resetDatabase = async (db: Database): Promise<void> => {
  const result = await db.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name <> ${MIGRATIONS_TABLE}
  `);
  const tables = result.rows.map((row) => sql.identifier(row.table_name));
  if (tables.length > 0) {
    await db.execute(
      sql`truncate table ${sql.join(tables, sql`, `)} restart identity cascade`,
    );
  }
  resetFactorySequences();
};

/**
 * Standalone Drizzle client on the e2e database, for specs that exercise the
 * database without booting the Nest app.
 */
export const connectTestDatabase = (): {
  db: Database;
  close: () => Promise<void>;
} => {
  const pool = createPool(inject('databaseUrl'));
  return { db: createDatabase(pool), close: () => pool.end() };
};
