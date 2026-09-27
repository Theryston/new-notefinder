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
import { createDatabase, createPool, type Database } from './database.js';
import { albums } from './schema/albums.js';
import { artists } from './schema/artists.js';
import {
  thumbnails,
  trackArtists,
  trackNotes,
  tracks,
} from './schema/tracks.js';
import { assertSeedAllowed, buildSeedData } from './seed-data.js';

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

const seed = async (db: Database): Promise<void> => {
  const data = buildSeedData();
  const trackIds = data.tracks.map((track) => track.id);

  await db.transaction(async (tx) => {
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
        inArray(trackNotes.trackId, trackIds),
        notInArray(
          trackNotes.id,
          data.trackNotes.map((note) => note.id),
        ),
      ),
    );
  });

  new Logger('Seed').log(
    `Seeded ${data.artists.length} artists, ${data.albums.length} albums, ` +
      `${data.tracks.length} tracks, ${data.trackNotes.length} notes`,
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
