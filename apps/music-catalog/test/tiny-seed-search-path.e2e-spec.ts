import { sql } from 'drizzle-orm';
import { inject } from 'vitest';
import { createDatabase, createPool } from '../src/database/database.js';
import { TINY_RECORDING_COUNT } from '../src/modules/bootstrap/tiny-seed.js';
import { TinySeedRepository } from '../src/modules/bootstrap/tiny-seed.repository.js';
import { resetDatabase } from './utils/database.js';

describe('tiny seed with MusicBrainz mirror triggers', () => {
  it('resolves unqualified trigger tables without leaking the search path', async () => {
    const pool = createPool(inject('databaseUrl'), () => undefined);
    const db = createDatabase(pool);
    try {
      await resetDatabase(db);
      await db.execute(sql`
        create function musicbrainz.seed_search_path_probe() returns trigger
        language plpgsql as $$
        begin
          insert into artist_release_group_pending_update values (NEW.id);
          return NEW;
        end;
        $$;
        create trigger seed_search_path_probe after insert
        on musicbrainz.release_group for each row
        execute function musicbrainz.seed_search_path_probe();
      `);
      const before = await db.execute(sql`show search_path`);
      await expect(new TinySeedRepository(db).seed()).resolves.toBe(
        TINY_RECORDING_COUNT,
      );
      const pending = await db.execute(sql`
        select count(*)::int as count
        from musicbrainz.artist_release_group_pending_update
      `);
      expect(pending.rows[0]).toEqual({ count: 11 });
      expect((await db.execute(sql`show search_path`)).rows).toEqual(
        before.rows,
      );
    } finally {
      await db.execute(sql`
        drop trigger if exists seed_search_path_probe on musicbrainz.release_group;
        drop function if exists musicbrainz.seed_search_path_probe();
      `);
      await resetDatabase(db);
      await pool.end();
    }
  });
});
