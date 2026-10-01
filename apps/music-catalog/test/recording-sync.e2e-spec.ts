import { sql } from 'drizzle-orm';
import { useTestServer } from './utils/create-test-server.js';
import { requestRecording } from './utils/get-recording-client.js';
import {
  addArtist,
  addRecording,
  addRecordingRedirect,
  deleteRecording,
  type FixtureRecording,
  mbid,
  renameArtist,
  renameRecording,
} from './utils/musicbrainz.js';
import {
  addArtistAlias,
  addGenre,
  addRelease,
  addTag,
  addTrack,
  addWork,
  renameRelease,
} from './utils/musicbrainz-relations.js';
import { requestSearch } from './utils/search-client.js';
import {
  createTestWorker,
  indexCatalog,
  useEmptySearchIndex,
} from './utils/test-worker.js';
import { useTestClient } from './utils/use-test-client.js';

// Every change to the MusicBrainz tables reaches the index through the
// outbox: the specs below write those tables directly (the way a dump or a
// replication packet would) and assert what a client sees over the
// WebSocket. Nothing asserts on the outbox rows themselves.
describe('recording sync: MusicBrainz changes reach the index (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  useEmptySearchIndex();

  const searchMbids = async (query: string): Promise<string[]> => {
    const response = await requestSearch(client(), { query });
    if (!response.ok) {
      throw new Error(`search failed: ${response.error.code}`);
    }
    return response.result.results.map((result) => result.mbid);
  };

  // Meilisearch applies the worker's writes before the tick returns, so one
  // pass is usually enough; the polling only covers scheduling slack.
  const pollFor = async (
    label: string,
    check: () => Promise<boolean>,
  ): Promise<void> => {
    const deadline = Date.now() + 20_000;
    for (;;) {
      if (await check()) {
        return;
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for ${label}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  };

  const syncOnce = async (): Promise<void> => {
    await createTestWorker(server()).tick();
  };

  const phase = async (): Promise<string | undefined> => {
    const response = await client().request('status');
    const status = response as { ok: true; result: { phase: string } };
    return status.result.phase;
  };

  it('makes a new Recording searchable and retrievable', async () => {
    await addRecording(server().db, {
      mbid: mbid(11),
      name: 'Amber Waves Song',
    });
    await indexCatalog(server());
    const newcomer = await addRecording(server().db, {
      mbid: mbid(12),
      name: 'Blue Moon Rising',
    });

    await syncOnce();
    await pollFor('the new Recording in search', async () =>
      (await searchMbids('Blue Moon Rising')).includes(newcomer.mbid),
    );

    const response = await requestRecording(client(), {
      mbid: newcomer.mbid,
    });
    expect(response).toMatchObject({
      ok: true,
      result: { title: 'Blue Moon Rising' },
    });
  });

  it('finds a renamed Recording by its new title, not the old one', async () => {
    // A neutral artist name: the default would repeat the title, and the old
    // words would stay searchable through the artist aliases.
    const artist = await addArtist(server().db, { name: 'Neutral Performer' });
    const tune = await addRecording(server().db, {
      mbid: mbid(21),
      name: 'Amber Waves Song',
      artists: [{ artist }],
    });
    await indexCatalog(server());

    await renameRecording(server().db, tune, 'Crimson Tides Song');
    await syncOnce();
    await pollFor('the new title in search', async () =>
      (await searchMbids('Crimson Tides')).includes(tune.mbid),
    );

    expect(await searchMbids('Amber Waves')).not.toContain(tune.mbid);
    const response = await requestRecording(client(), { mbid: tune.mbid });
    expect(response).toMatchObject({
      ok: true,
      result: { title: 'Crimson Tides Song' },
    });
  });

  it("makes an artist's Recordings searchable by a new alias", async () => {
    const artist = await addArtist(server().db, { name: 'Samuel Rivers' });
    const tune = await addRecording(server().db, {
      mbid: mbid(31),
      name: 'Riverbed Lullaby',
      artists: [{ artist }],
    });
    await indexCatalog(server());

    await addArtistAlias(server().db, artist, { name: 'Old Man Riverstone' });
    await syncOnce();
    await pollFor('the alias in search', async () =>
      (await searchMbids('Riverstone')).includes(tune.mbid),
    );
  });

  it('drops a deleted Recording from search and answers NOT_FOUND for it', async () => {
    const tune: FixtureRecording = await addRecording(server().db, {
      mbid: mbid(41),
      name: 'Vanishing Point Ballad',
    });
    await indexCatalog(server());

    await deleteRecording(server().db, tune);
    await syncOnce();
    await pollFor(
      'the deleted Recording out of search',
      async () => !(await searchMbids('Vanishing Point')).includes(tune.mbid),
    );

    const response = await requestRecording(client(), { mbid: tune.mbid });
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'RECORDING_NOT_FOUND' },
    });
  });

  it('answers MOVED for a merged Recording and keeps only the survivor in search', async () => {
    const oldTake = await addRecording(server().db, {
      mbid: mbid(51),
      name: 'Old Take Melody',
    });
    const survivor = await addRecording(server().db, {
      mbid: mbid(52),
      name: 'Survivor Take Melody',
    });
    await indexCatalog(server());

    await deleteRecording(server().db, oldTake);
    await addRecordingRedirect(server().db, oldTake.mbid, survivor);
    await syncOnce();
    await pollFor('the merge in search', async () => {
      const mbids = await searchMbids('Take Melody');
      return mbids.includes(survivor.mbid) && !mbids.includes(oldTake.mbid);
    });

    const response = await requestRecording(client(), {
      mbid: oldTake.mbid,
    });
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'RECORDING_MOVED', newMbid: survivor.mbid },
    });
  });

  it('processes changes made while the worker was down on its return', async () => {
    const tune = await addRecording(server().db, {
      mbid: mbid(61),
      name: 'Dormant Echo Waltz',
    });
    await indexCatalog(server());

    await renameRecording(server().db, tune, 'Wakeful Echo Waltz');

    // A new worker process, as after a restart: it finds the pending change.
    await createTestWorker(server()).tick();
    await pollFor('the change made while down', async () =>
      (await searchMbids('Wakeful Echo')).includes(tune.mbid),
    );
  });

  it('stays ready while changes wait, never answering CATALOG_NOT_READY', async () => {
    await addRecording(server().db, {
      mbid: mbid(71),
      name: 'Patient Overture Tune',
    });
    await indexCatalog(server());
    const newcomer = await addRecording(server().db, {
      mbid: mbid(72),
      name: 'Impatient Overture Tune',
    });

    expect(await phase()).toBe('ready');
    const pending = await requestSearch(client(), { query: 'Overture' });
    expect(pending.ok).toBe(true);

    await syncOnce();
    await pollFor('the waiting Recording in search', async () =>
      (await searchMbids('Impatient Overture')).includes(newcomer.mbid),
    );
  });

  it('reinstalls a missing trigger and drops a stale trigger and function on the next tick', async () => {
    const db = server().db;
    const artist = await addArtist(db, { name: 'Beatrix Potter' });
    const tune = await addRecording(db, {
      mbid: mbid(91),
      name: 'Tarnished Brass Nocturne',
      artists: [{ artist }],
    });
    await indexCatalog(server());
    const syncTriggerNames = async (): Promise<string[]> => {
      const pattern = 'notefinder_sync\\_%';
      const result = await db.execute<{ name: string }>(
        sql`select tgname as "name" from pg_trigger where tgname like ${pattern}`,
      );
      return result.rows.map((row) => row.name).sort();
    };
    await db.execute(
      sql`drop trigger notefinder_sync_artist_alias on musicbrainz.artist_alias`,
    );
    await db.execute(
      sql`create function music_catalog.sync_outbox_from_retired() returns trigger
        language plpgsql as $fn$ begin return null; end; $fn$`,
    );
    await db.execute(
      sql`create trigger notefinder_sync_retired after insert on musicbrainz.isrc
        for each row execute function music_catalog.sync_outbox_from_retired()`,
    );

    await syncOnce();

    const names = await syncTriggerNames();
    expect(names).toContain('notefinder_sync_artist_alias');
    expect(names).not.toContain('notefinder_sync_retired');
    const functionPattern = 'sync_outbox_from\\_%';
    const functions = await db.execute<{ name: string }>(
      sql`select p.proname as "name" from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'music_catalog'
          and p.proname like ${functionPattern}`,
    );
    expect(functions.rows.map((row) => row.name)).not.toContain(
      'sync_outbox_from_retired',
    );

    await addArtistAlias(db, artist, { name: 'Zephyrian Brass' });
    await syncOnce();
    await pollFor('the alias in search', async () =>
      (await searchMbids('Zephyrian')).includes(tune.mbid),
    );
  });

  it('reindexes when a release is renamed', async () => {
    const tune = await addRecording(server().db, {
      mbid: mbid(81),
      name: 'Harbor Lights Chant',
    });
    const release = await addRelease(server().db, {
      name: 'Harbor Songs Collection',
      artistCredit: tune.artistCredit,
    });
    await addTrack(server().db, { release, recording: tune });
    await indexCatalog(server());

    await renameRelease(server().db, release, 'Lighthouse Songs Collection');
    await syncOnce();
    await pollFor('the new release title in search', async () =>
      (await searchMbids('Lighthouse')).includes(tune.mbid),
    );
  });

  it('reindexes when a Work is linked', async () => {
    const tune = await addRecording(server().db, {
      mbid: mbid(82),
      name: 'Paper Lantern Reel',
    });
    await indexCatalog(server());

    await addWork(server().db, tune, { name: 'Clockmakers Cantata' });
    await syncOnce();
    await pollFor('the Work title in search', async () =>
      (await searchMbids('Clockmakers')).includes(tune.mbid),
    );
  });

  it('reindexes when a genre tag is added', async () => {
    await addGenre(server().db, { name: 'shoegaze', mbid: mbid(901) });
    const tune = await addRecording(server().db, {
      mbid: mbid(83),
      name: 'Velvet Static Haze',
    });
    await indexCatalog(server());

    await addTag(
      server().db,
      { recording: tune },
      { name: 'shoegaze', count: 5 },
    );
    await syncOnce();
    await pollFor('the genre in search', async () =>
      (await searchMbids('shoegaze')).includes(tune.mbid),
    );
  });

  it('reindexes when an artist is renamed', async () => {
    const artist = await addArtist(server().db, { name: 'The Starlings' });
    const tune = await addRecording(server().db, {
      mbid: mbid(84),
      name: 'Migration Patterns Song',
      artists: [{ artist }],
    });
    await indexCatalog(server());

    await renameArtist(server().db, artist, 'The Nightingales');
    await syncOnce();
    await pollFor('the new artist name in search', async () =>
      (await searchMbids('Nightingales')).includes(tune.mbid),
    );
  });

  it('reindexes when a Recording is put on another release', async () => {
    const tune = await addRecording(server().db, {
      mbid: mbid(85),
      name: 'Wandering Verse Hymn',
    });
    const release = await addRelease(server().db, {
      name: 'Desert Anthology Volume',
      artistCredit: tune.artistCredit,
    });
    await indexCatalog(server());

    await addTrack(server().db, { release, recording: tune });
    await syncOnce();
    await pollFor('the new release title in search', async () =>
      (await searchMbids('Desert Anthology')).includes(tune.mbid),
    );
  });
});
