import { sql } from 'drizzle-orm';
import type { Database } from '../../src/database/database.js';
import { bootstrapState } from '../../src/database/schema/bootstrap-state.js';
import { replicationState } from '../../src/database/schema/replication-state.js';
import { resetMusicBrainz } from './musicbrainz.js';

/**
 * Empties every table of the service's schema (discovered from the database,
 * so new tables are covered without touching this helper) and the MusicBrainz
 * tables the fixture writes to. Call it in `beforeEach` of specs that write to
 * the database.
 */
export const resetDatabase = async (db: Database): Promise<void> => {
  await resetMusicBrainz(db);
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

/** Records the last applied replication packet, as the loop would. */
export const setReplicationState = async (
  db: Database,
  lastSequence: number,
): Promise<void> => {
  await db
    .insert(replicationState)
    .values({ lastSequence })
    .onConflictDoUpdate({
      target: replicationState.id,
      set: { lastSequence },
    });
};

/**
 * Moves mbslave's own cursor, the way an applied replication packet would
 * (the full dump ships the row; the sample leaves the table empty). 31 is
 * the pinned schema sequence both the container and the e2e schema build.
 */
export const setReplicationControl = async (
  db: Database,
  sequence: number,
): Promise<void> => {
  await db.execute(sql`delete from musicbrainz.replication_control`);
  await db.execute(
    sql`insert into musicbrainz.replication_control
      (current_schema_sequence, current_replication_sequence)
      values (31, ${sequence})`,
  );
};
