import { sql } from 'drizzle-orm';
import type { Database } from '../../src/database/database.js';
import { bootstrapState } from '../../src/database/schema/bootstrap-state.js';

/**
 * Empties every table of the service's schema (discovered from the database,
 * so new tables are covered without touching this helper). Call it in
 * `beforeEach` of specs that write to the database.
 */
export const resetDatabase = async (db: Database): Promise<void> => {
  const result = await db.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables
    where table_schema = 'music_catalog' and table_type = 'BASE TABLE'
  `);
  const tables = result.rows.map(
    (row) =>
      sql`${sql.identifier('music_catalog')}.${sql.identifier(row.table_name)}`,
  );
  if (tables.length > 0) {
    await db.execute(
      sql`truncate table ${sql.join(tables, sql`, `)} restart identity cascade`,
    );
  }
};

/** Writes the row the import keeps, as it would at each step of it. */
export const setBootstrapState = async (
  db: Database,
  state: Pick<typeof bootstrapState.$inferInsert, 'phase' | 'dataset'>,
): Promise<void> => {
  await db
    .insert(bootstrapState)
    .values(state)
    .onConflictDoUpdate({ target: bootstrapState.id, set: state });
};
