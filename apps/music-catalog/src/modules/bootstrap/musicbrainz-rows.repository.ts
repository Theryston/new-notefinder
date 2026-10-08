import { type SQL, sql } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';

type Value = string | number | boolean | null;
type Rows = readonly (readonly Value[])[];
/** The ids the database gave the rows, by their MBID (or name). */
export type Ids = Map<string, number>;

const musicbrainz = (table: string): SQL =>
  sql`${sql.identifier('musicbrainz')}.${sql.identifier(table)}`;

const insertSql = (table: string, columns: readonly string[], rows: Rows) =>
  sql`insert into ${musicbrainz(table)}
    (${sql.join(
      columns.map((column) => sql.identifier(column)),
      sql`, `,
    )})
    values ${sql.join(
      rows.map(
        (row) =>
          sql`(${sql.join(
            row.map((value) => sql`${value}`),
            sql`, `,
          )})`,
      ),
      sql`, `,
    )}`;

export const idOf = (ids: Ids, key: string): number => {
  const id = ids.get(key);
  if (id === undefined) {
    throw new Error(`The tiny seed lost a row it just wrote: ${key}`);
  }
  return id;
};

/**
 * Bulk inserts into the MusicBrainz schema with plain SQL, the way a dump
 * writes its rows: one statement per table, every row in it.
 */
export class MusicBrainzRowWriter {
  private readonly getDb: () => Database;

  constructor(db: DatabaseSource) {
    this.getDb = typeof db === 'function' ? db : () => db;
  }

  async insert(
    table: string,
    columns: readonly string[],
    rows: Rows,
  ): Promise<void> {
    if (rows.length > 0) {
      await this.getDb().execute(insertSql(table, columns, rows));
    }
  }

  /** Inserts the rows and returns their ids by the value of `keyColumn`. */
  async insertReturning(
    table: string,
    columns: readonly string[],
    rows: Rows,
    keyColumn = 'gid',
  ): Promise<Ids> {
    if (rows.length === 0) {
      return new Map();
    }
    const result = await this.getDb().execute<{ id: number; key: string }>(
      sql`${insertSql(table, columns, rows)}
        returning id, ${sql.identifier(keyColumn)}::text as key`,
    );
    return new Map(result.rows.map((row) => [row.key, row.id]));
  }
}
