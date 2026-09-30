import { Logger } from '@nestjs/common';
import { getTableColumns, type SQL, sql } from 'drizzle-orm';
import { toSnakeCase } from 'drizzle-orm/casing';
import type { PgTable } from 'drizzle-orm/pg-core';
import { loadEnv } from '../config/env.js';
import { hashPassword } from '../modules/auth/password.js';
import { createDatabase, createPool, type Database } from './database.js';
import { accounts } from './schema/auth.js';
import { users } from './schema/users.js';
import {
  assertSeedAllowed,
  SEED_USER,
  SEED_USER_PASSWORD,
} from './seed-data.js';

/**
 * `nub run db:seed`: writes the deterministic development data from
 * `seed-data.ts`. Idempotent: rows are upserted by their fixed IDs, so running
 * it again restores the seed rows without duplicating anything.
 */

/**
 * `on conflict do update` assignments that overwrite every column except the
 * primary key and `createdAt` with the incoming (`excluded`) values. Columns
 * are named by key, so the SQL name is the key in snake_case (the `casing`
 * the client uses).
 */
const overwriteOnConflict = (table: PgTable): Record<string, SQL> =>
  Object.fromEntries(
    Object.keys(getTableColumns(table))
      .filter((key) => key !== 'id' && key !== 'createdAt')
      .map((key) => [key, sql`excluded.${sql.identifier(toSnakeCase(key))}`]),
  );

/** Better Auth's email/password sign-in reads the `credential` account. */
const seedCredential = async () => ({
  id: `${SEED_USER.id}credential`,
  providerId: 'credential',
  accountId: SEED_USER.id,
  userId: SEED_USER.id,
  password: await hashPassword(SEED_USER_PASSWORD),
});

const seed = async (db: Database): Promise<void> => {
  const credential = await seedCredential();

  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values(SEED_USER)
      .onConflictDoUpdate({
        target: users.id,
        set: overwriteOnConflict(users),
      });
    await tx
      .insert(accounts)
      .values(credential)
      .onConflictDoUpdate({
        target: accounts.id,
        set: overwriteOnConflict(accounts),
      });
  });

  new Logger('Seed').log(
    `Seeded the development user. Sign in as ${SEED_USER.email} / ` +
      `${SEED_USER_PASSWORD}`,
  );
};

const env = loadEnv();
assertSeedAllowed(env.NODE_ENV);

const pool = createPool(env.DATABASE_URL);
try {
  await seed(createDatabase(pool));
} finally {
  await pool.end();
}
