import { Logger } from '@nestjs/common';
import {
  and,
  getTableColumns,
  inArray,
  notInArray,
  type SQL,
  sql,
} from 'drizzle-orm';
import { toSnakeCase } from 'drizzle-orm/casing';
import type { PgTable } from 'drizzle-orm/pg-core';
import { loadEnv } from '../config/env.js';
import { hashPassword } from '../modules/auth/password.js';
import { createDatabase, createPool, type Database } from './database.js';
import { albums } from './schema/albums.js';
import { artists } from './schema/artists.js';
import { accounts } from './schema/auth.js';
import {
  thumbnails,
  trackArtists,
  trackNotes,
  tracks,
} from './schema/tracks.js';
import { users } from './schema/users.js';
import {
  assertSeedAllowed,
  buildSeedData,
  SEED_USER,
  SEED_USER_PASSWORD,
} from './seed-data.js';

/**
 * `nub run db:seed`: writes the deterministic development catalog from
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

const NOTES_PER_INSERT = 1000;

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type SeedData = ReturnType<typeof buildSeedData>;

/** Better Auth's email/password sign-in reads the `credential` account. */
const seedCredential = async () => ({
  id: `${SEED_USER.id}credential`,
  providerId: 'credential',
  accountId: SEED_USER.id,
  userId: SEED_USER.id,
  password: await hashPassword(SEED_USER_PASSWORD),
});

const upsertUsers = async (
  tx: Transaction,
  data: SeedData,
  credential: Awaited<ReturnType<typeof seedCredential>>,
) => {
  await tx
    .insert(users)
    .values(data.users)
    .onConflictDoUpdate({ target: users.id, set: overwriteOnConflict(users) });
  await tx
    .insert(accounts)
    .values(credential)
    .onConflictDoUpdate({
      target: accounts.id,
      set: overwriteOnConflict(accounts),
    });
};

const upsertCatalog = async (tx: Transaction, data: SeedData) => {
  await tx
    .insert(artists)
    .values(data.artists)
    .onConflictDoUpdate({
      target: artists.id,
      set: overwriteOnConflict(artists),
    });
  await tx
    .insert(albums)
    .values(data.albums)
    .onConflictDoUpdate({
      target: albums.id,
      set: overwriteOnConflict(albums),
    });
  await tx
    .insert(tracks)
    .values(data.tracks)
    .onConflictDoUpdate({
      target: tracks.id,
      set: overwriteOnConflict(tracks),
    });
  await tx
    .insert(trackArtists)
    .values(data.trackArtists)
    .onConflictDoUpdate({
      target: trackArtists.id,
      set: overwriteOnConflict(trackArtists),
    });
  await tx
    .insert(thumbnails)
    .values(data.thumbnails)
    .onConflictDoUpdate({
      target: thumbnails.id,
      set: overwriteOnConflict(thumbnails),
    });
};

const replaceTrackNotes = async (tx: Transaction, data: SeedData) => {
  for (
    let offset = 0;
    offset < data.trackNotes.length;
    offset += NOTES_PER_INSERT
  ) {
    await tx
      .insert(trackNotes)
      .values(data.trackNotes.slice(offset, offset + NOTES_PER_INSERT))
      .onConflictDoUpdate({
        target: trackNotes.id,
        set: overwriteOnConflict(trackNotes),
      });
  }

  // Drop notes left behind by an older version of the generator.
  await tx.delete(trackNotes).where(
    and(
      inArray(
        trackNotes.trackId,
        data.tracks.map((track) => track.id),
      ),
      notInArray(
        trackNotes.id,
        data.trackNotes.map((note) => note.id),
      ),
    ),
  );
};

const seed = async (db: Database): Promise<void> => {
  const data = buildSeedData();
  const credential = await seedCredential();

  await db.transaction(async (tx) => {
    await upsertUsers(tx, data, credential);
    await upsertCatalog(tx, data);
    await replaceTrackNotes(tx, data);
  });

  new Logger('Seed').log(
    `Seeded ${data.users.length} user(s), ${data.artists.length} artists, ` +
      `${data.albums.length} albums, ${data.tracks.length} tracks, ` +
      `${data.trackNotes.length} notes. Sign in as ${SEED_USER.email} / ` +
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
