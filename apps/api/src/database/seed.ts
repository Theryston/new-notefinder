import { Logger } from '@nestjs/common';
import { getTableColumns, type SQL, sql } from 'drizzle-orm';
import { toSnakeCase } from 'drizzle-orm/casing';
import type { PgTable } from 'drizzle-orm/pg-core';
import { loadEnv } from '../config/env.js';
import { hashPassword } from '../modules/auth/password.js';
import { createDatabase, createPool, type Database } from './database.js';
import {
  albumArtists,
  albumDiscs,
  albums,
  albumTracks,
  legacyAlbumIds,
} from './schema/albums.js';
import { artists, trackArtists } from './schema/artists.js';
import { accounts } from './schema/auth.js';
import { trackProcessings } from './schema/track-processings.js';
import {
  trackExternalLinks,
  trackReleases,
  tracks,
  trackTags,
  trackWorks,
} from './schema/tracks.js';
import { users } from './schema/users.js';
import {
  SEED_ALBUM_ARTISTS,
  SEED_ALBUM_DISCS,
  SEED_ALBUM_TRACKS,
  SEED_ALBUMS,
  SEED_LEGACY_ALBUM_IDS,
} from './seed-albums.js';
import {
  assertSeedAllowed,
  SEED_ARTISTS,
  SEED_TRACK_ARTISTS,
  SEED_TRACK_PROCESSINGS,
  SEED_TRACKS,
  SEED_USER,
  SEED_USER_PASSWORD,
} from './seed-data.js';
import {
  SEED_TRACK_EXTERNAL_LINKS,
  SEED_TRACK_RELEASES,
  SEED_TRACK_TAGS,
  SEED_TRACK_WORKS,
} from './seed-track-details.js';

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

/** Minimal insert surface the seed helpers need (both Database and its tx). */
type SeedTx = Pick<Database, 'insert'>;

const seedUser = async (
  tx: SeedTx,
  credential: Awaited<ReturnType<typeof seedCredential>>,
): Promise<void> => {
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
};

const seedArtistsAndTracks = async (tx: SeedTx): Promise<void> => {
  for (const artist of SEED_ARTISTS) {
    await tx
      .insert(artists)
      .values(artist)
      .onConflictDoUpdate({
        target: artists.id,
        set: overwriteOnConflict(artists),
      });
  }
  for (const track of SEED_TRACKS) {
    await tx
      .insert(tracks)
      .values(track)
      .onConflictDoUpdate({
        target: tracks.id,
        set: overwriteOnConflict(tracks),
      });
  }
  await tx
    .insert(trackArtists)
    .values(SEED_TRACK_ARTISTS)
    .onConflictDoNothing();
  for (const processing of SEED_TRACK_PROCESSINGS) {
    await tx
      .insert(trackProcessings)
      .values(processing)
      .onConflictDoUpdate({
        target: trackProcessings.id,
        set: overwriteOnConflict(trackProcessings),
      });
  }
};

/** Albums need their artists in place first (the credits reference them). */
const seedAlbums = async (tx: SeedTx): Promise<void> => {
  for (const album of SEED_ALBUMS) {
    await tx
      .insert(albums)
      .values(album)
      .onConflictDoUpdate({
        target: albums.id,
        set: overwriteOnConflict(albums),
      });
  }
  await tx
    .insert(albumArtists)
    .values(SEED_ALBUM_ARTISTS)
    .onConflictDoNothing();
  for (const disc of SEED_ALBUM_DISCS) {
    await tx
      .insert(albumDiscs)
      .values(disc)
      .onConflictDoUpdate({
        target: [albumDiscs.albumId, albumDiscs.position],
        set: overwriteOnConflict(albumDiscs),
      });
  }
  for (const track of SEED_ALBUM_TRACKS) {
    await tx
      .insert(albumTracks)
      .values(track)
      .onConflictDoUpdate({
        target: [albumTracks.albumId, albumTracks.trackId],
        set: overwriteOnConflict(albumTracks),
      });
  }
  await tx
    .insert(legacyAlbumIds)
    .values(SEED_LEGACY_ALBUM_IDS)
    .onConflictDoNothing();
};

const seedTrackDetails = async (tx: SeedTx): Promise<void> => {
  for (const release of SEED_TRACK_RELEASES) {
    await tx
      .insert(trackReleases)
      .values(release)
      .onConflictDoUpdate({
        target: trackReleases.id,
        set: overwriteOnConflict(trackReleases),
      });
  }
  for (const work of SEED_TRACK_WORKS) {
    await tx
      .insert(trackWorks)
      .values(work)
      .onConflictDoUpdate({
        target: trackWorks.id,
        set: overwriteOnConflict(trackWorks),
      });
  }
  for (const tag of SEED_TRACK_TAGS) {
    await tx
      .insert(trackTags)
      .values(tag)
      .onConflictDoUpdate({
        target: trackTags.id,
        set: overwriteOnConflict(trackTags),
      });
  }
  for (const link of SEED_TRACK_EXTERNAL_LINKS) {
    await tx
      .insert(trackExternalLinks)
      .values(link)
      .onConflictDoUpdate({
        target: trackExternalLinks.id,
        set: overwriteOnConflict(trackExternalLinks),
      });
  }
};

const seed = async (db: Database): Promise<void> => {
  const credential = await seedCredential();

  await db.transaction(async (tx) => {
    await seedUser(tx, credential);
    await seedArtistsAndTracks(tx);
    await seedAlbums(tx);
    await seedTrackDetails(tx);
  });

  new Logger('Seed').log(
    `Seeded the development user. Sign in as ${SEED_USER.email} / ` +
      `${SEED_USER_PASSWORD}`,
  );
  new Logger('Seed').log(
    `Seeded ${SEED_ARTISTS.length} artists and ${SEED_TRACKS.length} tracks.`,
  );
  new Logger('Seed').log(`Seeded ${SEED_ALBUMS.length} albums.`);
};

const env = loadEnv();
assertSeedAllowed(env.NODE_ENV);

const pool = createPool(env.DATABASE_URL);
try {
  await seed(createDatabase(pool));
} finally {
  await pool.end();
}
