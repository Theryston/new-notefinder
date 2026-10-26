import { sql } from 'drizzle-orm';
import type { Database } from '../../database/database.js';

/** Reads the stable PostgreSQL identity used to recover a catalog index swap. */
export class DatabaseIdentityRepository {
  constructor(private readonly database: Database) {}

  async getOid(): Promise<string> {
    const result = await this.database.execute<{ databaseOid: string }>(sql`
      select oid::text as "databaseOid"
      from pg_database
      where datname = current_database()
    `);
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('Could not read the database identity.');
    }
    return row.databaseOid;
  }
}
