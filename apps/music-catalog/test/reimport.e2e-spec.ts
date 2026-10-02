import { fileURLToPath } from 'node:url';
import { musicCatalogStatusResponseSchema } from '@notefinder/contracts';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { inject } from 'vitest';
import type { Database } from '../src/database/database.js';
import { createDatabase, createPool } from '../src/database/database.js';
import { MbslaveClient } from '../src/integrations/mbslave/mbslave-client.js';
import { BootstrapRepository } from '../src/modules/bootstrap/bootstrap.repository.js';
import { BootstrapService } from '../src/modules/bootstrap/bootstrap.service.js';
import { RestoreService } from '../src/modules/bootstrap/restore.service.js';
import { LyricsRepository } from '../src/modules/lyrics/lyrics.repository.js';
import { ReimportRestoreService } from '../src/modules/reimport/reimport-restore.service.js';
import { ReimportStateRepository } from '../src/modules/reimport/reimport-state.repository.js';
import { ReplicationRepository } from '../src/modules/replication/replication.repository.js';
import { ReplicationService } from '../src/modules/replication/replication.service.js';
import { RecordingOutboxRepository } from '../src/modules/sync/recording-outbox.repository.js';
import { applyMusicBrainzSchema } from './setup/musicbrainz-schema.js';
import { testLogger } from './utils/create-test-server.js';
import {
  resetDatabase,
  setBootstrapState,
  setReplicationControl,
} from './utils/database.js';
import { requestRecording } from './utils/get-recording-client.js';
import { useIsolatedServer } from './utils/isolated-server.js';
import { meilisearchRequest } from './utils/meilisearch-http.js';
import { addRecording, mbid } from './utils/musicbrainz.js';
import { requestSearch } from './utils/search-client.js';
import {
  createTestWorker,
  useEmptyLyricsIndex,
  useEmptySearchIndex,
} from './utils/test-worker.js';

// The yearly schema change, simulated the way the other suites simulate
// what cannot run in CI: the mbslave binary stays behind its integration
// boundary (a fake `sync` fails with the schema mismatch, a fake
// `init`/`import` lays the "new dump" into a second database), while the
// stall, the state machine, the Meilisearch swap and the cutover are the
// real code against the real Postgres, Meilisearch and WebSocket.
// Spawning the real binary is deliberately out (its Python/psql image,
// minutes per run and a MetaBrainz token, like the first import and
// replication suites document).
describe('yearly schema change: blue-green reimport (e2e)', {
  timeout: 120_000,
}, () => {
  // One server per test (not per file): a switch test flips its process to
  // the parallel database, and the next test must read the serving copy
  // again. Booting per test is what keeps the adoption honest.
  const { server, client } = useIsolatedServer();

  useEmptySearchIndex();
  useEmptyLyricsIndex();

  // The parallel copy: a second database on the same server, migrated and
  // holding the real MusicBrainz schema like the mbslave container leaves
  // it. Created once per file; every test starts it empty (below).
  let nextUrl = '';
  let nextPool: ReturnType<typeof createPool> | undefined;
  let nextDb: Database | undefined;
  const parallel = (): { url: string; db: Database } => {
    if (nextDb === undefined) {
      throw new Error('The parallel database is only available inside a test');
    }
    return { url: nextUrl, db: nextDb };
  };

  beforeAll(async () => {
    const url = new URL(inject('databaseUrl'));
    url.pathname = `${url.pathname.replace(/\/$/, '')}_reimport`;
    nextUrl = url.toString();
    const admin = new Client({ connectionString: inject('databaseUrl') });
    await admin.connect();
    try {
      await admin.query(
        `DROP DATABASE IF EXISTS "${url.pathname.slice(1).replace(/"/g, '""')}"`,
      );
      await admin.query(
        `CREATE DATABASE "${url.pathname.slice(1).replace(/"/g, '""')}"`,
      );
    } finally {
      await admin.end();
    }
    nextPool = createPool(nextUrl, () => undefined);
    nextDb = createDatabase(nextPool);
    await migrate(nextDb, {
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
    await applyMusicBrainzSchema(nextUrl);
  });

  afterAll(async () => {
    await nextPool?.end();
    // The switch tests flip their server to the parallel database through
    // pools the suite does not own: terminate every backend before dropping
    // it, the way the service drops a retired copy.
    const adminPool = createPool(inject('databaseUrl'), () => undefined);
    try {
      const name = new URL(nextUrl).pathname.slice(1);
      await new ReimportStateRepository(createDatabase(adminPool)).dropDatabase(
        name,
      );
    } finally {
      await adminPool.end();
    }
  });

  beforeEach(async () => {
    await resetDatabase(parallel().db);
    await dropParallelSyncTriggers(parallel().db);
    // Fire and forget: Meilisearch runs tasks in order, so a delete queued
    // here finishes before anything the test enqueues (missing indexes 404,
    // which is fine).
    const meilisearch = inject('meilisearch');
    void meilisearchRequest(meilisearch, 'DELETE', '/indexes/recordings_next');
    void meilisearchRequest(meilisearch, 'DELETE', '/indexes/lyrics_next');
  });

  // Production restores into a fresh parallel database per reimport, which
  // has no change triggers until the worker installs them. The suite reuses
  // one database, so a previous test's triggers are dropped to restore that
  // precondition (resetting tables is not enough: seeding through leftover
  // triggers would enqueue entries the fresh copy never has).
  const dropParallelSyncTriggers = async (db: Database): Promise<void> => {
    const triggers = await db.execute<{ name: string; table: string }>(sql`
      select t.tgname as "name", c.relname as "table"
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'musicbrainz'
        and t.tgname like 'notefinder\_sync\_%'
        and not t.tgisinternal
    `);
    for (const trigger of triggers.rows) {
      await db.execute(sql`
        drop trigger ${sql.identifier(trigger.name)}
        on ${sql.identifier('musicbrainz')}.${sql.identifier(trigger.table)}
      `);
    }
    const functions = await db.execute<{ name: string }>(sql`
      select p.proname as "name"
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'music_catalog'
        and p.proname like 'sync\_outbox\_from\_%'
    `);
    for (const fn of functions.rows) {
      await db.execute(sql`
        drop function ${sql.identifier('music_catalog')}.${sql.identifier(fn.name)}()
      `);
    }
  };

  const statusResult = async () => {
    const response = musicCatalogStatusResponseSchema.parse(
      await client().request('status', {}),
    );
    if (!response.ok) {
      throw new Error(`status failed: ${response.error.code}`);
    }
    return response.result;
  };

  // Every catalog read below asserts `ok`, which is also the proof the
  // service never answers `CATALOG_NOT_READY` during the reimport: any
  // not-ready answer arrives as `ok: false`.
  const searchMbids = async (
    query: string,
    scope?: 'metadata' | 'lyrics',
  ): Promise<string[]> => {
    const response = await requestSearch(
      client(),
      scope === undefined ? { query } : { query, scope },
    );
    if (!response.ok) {
      throw new Error(`search failed: ${response.error.code}`);
    }
    return response.result.results.map((result) => result.mbid);
  };

  const recordingLyrics = async (recordingMbid: string) => {
    const response = await requestRecording(client(), { mbid: recordingMbid });
    if (!response.ok) {
      throw new Error(
        `getRecording failed: ${response.error.code} for ${recordingMbid}`,
      );
    }
    return response.result.lyrics;
  };

  const replicationWith = (
    db: Database,
    sync: () => Promise<void>,
  ): ReplicationService => {
    const sequences = new ReplicationRepository(db);
    return new ReplicationService({
      sequences,
      backlog: new RecordingOutboxRepository(db),
      mbslave: new MbslaveClient(sync),
      dataset: 'full',
      musicbrainzToken: 'e2e-token',
      stalls: sequences,
      mbslaveRef: 'v31.0.1',
      pollIntervalMs: 1,
      logger: testLogger,
    });
  };

  const stallReplication = async (db: Database): Promise<void> => {
    const replication = replicationWith(db, async () => {
      throw new Error('mbslave sync failed (exit 1): Mismatched schema');
    });
    await expect(replication.replicateOnce()).rejects.toThrow(
      'Mismatched schema',
    );
  };

  // The mbslave container, simulated: the "new dump" of the yearly schema
  // change lands in the parallel database through the real `RestoreService`
  // (real bootstrap rows, real `init`/`import` flow), with the binary faked.
  const restoreParallel = async (
    seed?: (db: Database) => Promise<void>,
  ): Promise<'restored'> => {
    const { db } = parallel();
    const mbslave = new MbslaveClient(async (args) => {
      if (args[0] === 'init') {
        await applyMusicBrainzSchema(nextUrl);
        return;
      }
      if (args[0] === 'import') {
        await seed?.(db);
        return;
      }
      throw new Error(`unexpected mbslave call: ${args.join(' ')}`);
    });
    const container = new ReimportRestoreService({
      bootstrap: new BootstrapService(
        new BootstrapRepository(server().db),
        'full',
      ),
      replication: replicationWith(server().db, async () => undefined),
      state: new ReimportStateRepository(server().db),
      nextState: {
        getState: () => new BootstrapRepository(db).getState(),
      },
      restore: new RestoreService({
        repository: new BootstrapRepository(db),
        mbslave,
        resolveUrls: async () => [
          'http://fake/fullexport/2026-05-01-00-00-00/mbdump.tar.bz2',
        ],
        resolveTotalBytes: async () => undefined,
        seedTiny: async () => 0,
        baseUrl: 'http://fake/',
        dataset: 'full',
        logger: testLogger,
      }),
      currentMbslaveRef: 'v32.0.0',
      servingDatabaseUrl: inject('databaseUrl'),
      nextDatabaseUrl: nextUrl,
      dataset: 'full',
      logger: testLogger,
    });
    const outcome = await container.maybeRestore();
    expect(outcome).toBe('restored');
    return 'restored';
  };

  // The serving copy of the flow tests: three Recordings, two with kept
  // Lyrics, indexed and `ready`, with replication stalled on the schema
  // change. A closed port answers the LRCLIB listing, so any download
  // attempt fails the tick instead of hiding: the reimport must never
  // download Lyrics again.
  const serveCatalog = async (): Promise<
    ReturnType<typeof createTestWorker>
  > => {
    const db = server().db;
    await addRecording(db, {
      mbid: mbid(901),
      name: 'Same Take Song',
      lengthMs: 180_000,
    });
    await addRecording(db, {
      mbid: mbid(902),
      name: 'Resized Take Song',
      lengthMs: 180_000,
    });
    await addRecording(db, {
      mbid: mbid(904),
      name: 'Steady Control Song',
      lengthMs: 180_000,
    });
    await setBootstrapState(db, { phase: 'restored', dataset: 'full' });
    await setReplicationControl(db, 199_999);
    const worker = createTestWorker(server(), {
      env: {
        CATALOG_DATASET: 'full',
        LRCLIB_BASE_URL: 'http://127.0.0.1:9/',
        LRCLIB_LISTING_URL: 'http://127.0.0.1:9/',
      },
    });
    await worker.tick();
    await new LyricsRepository(db).saveLyrics([
      { mbid: mbid(901), plainLyrics: 'same take la', syncedLyrics: null },
      { mbid: mbid(902), plainLyrics: 'resized take la', syncedLyrics: null },
    ]);
    // A stale backlog entry: the switch must drop what the retired copy
    // queued, since its MBIDs are meaningless on the new one.
    await addRecording(db, {
      mbid: mbid(905),
      name: 'Backlog Trigger Song',
      lengthMs: 180_000,
    });
    await stallReplication(db);
    return createTestWorker(server(), {
      env: {
        CATALOG_DATASET: 'full',
        LRCLIB_BASE_URL: 'http://127.0.0.1:9/',
        LRCLIB_LISTING_URL: 'http://127.0.0.1:9/',
      },
      nextCopy: { db: parallel().db, url: nextUrl },
    });
  };

  const seedNewDump = async (db: Database): Promise<void> => {
    await addRecording(db, {
      mbid: mbid(901),
      name: 'Same Take Song',
      lengthMs: 180_000,
    });
    await addRecording(db, {
      mbid: mbid(902),
      name: 'Resized Take Song',
      lengthMs: 200_000,
    });
    await addRecording(db, {
      mbid: mbid(903),
      name: 'Brand New Next Song',
      lengthMs: 200_000,
    });
    await addRecording(db, {
      mbid: mbid(904),
      name: 'Steady Control Song',
      lengthMs: 180_000,
    });
    await setReplicationControl(db, 200_001);
  };

  it('reports the schema-change stall while search and getRecording answer', async () => {
    const db = server().db;
    await addRecording(db, {
      mbid: mbid(911),
      name: 'Stall Witness Song',
      lengthMs: 180_000,
    });
    await setBootstrapState(db, { phase: 'restored', dataset: 'full' });
    await setReplicationControl(db, 199_999);
    const worker = createTestWorker(server(), {
      env: {
        CATALOG_DATASET: 'full',
        LRCLIB_BASE_URL: 'http://127.0.0.1:9/',
        LRCLIB_LISTING_URL: 'http://127.0.0.1:9/',
      },
    });
    await worker.tick();

    await stallReplication(db);

    await expect(statusResult()).resolves.toMatchObject({
      phase: 'ready',
      dataset: 'full',
      replicationSequence: 199_999,
      // The fixture write above reached the outbox through the triggers,
      // the way a replication packet's DML would: the stall and the lag
      // report together.
      pendingOutbox: 1,
      replicationStalled: { reason: 'schema-change' },
    });
    await expect(searchMbids('Stall Witness')).resolves.toEqual([mbid(911)]);
    await expect(recordingLyrics(mbid(911))).resolves.toEqual({
      plain: null,
      synced: null,
    });
  });

  it('reimports into the parallel copy while the serving copy answers', async () => {
    const worker = await serveCatalog();

    await restoreParallel(seedNewDump);

    // The container handed a restored copy over: the worker owns it now,
    // and `status` shows the reimport while the first import stays `ready`.
    await expect(statusResult()).resolves.toMatchObject({
      phase: 'ready',
      reimport: { phase: 'indexing' },
    });

    await worker.tick();

    // Indexed, not yet switched: the serving copy answers exactly what it
    // did before, and the new Recording is nowhere to be found yet.
    await expect(statusResult()).resolves.toMatchObject({
      phase: 'ready',
      reimport: { phase: 'switching', progressPct: 100 },
    });
    await expect(searchMbids('Same Take Song')).resolves.toEqual([mbid(901)]);
    await expect(searchMbids('Brand New Next')).resolves.toEqual([]);
    await expect(recordingLyrics(mbid(901))).resolves.toEqual({
      plain: 'same take la',
      synced: null,
    });
  });

  it('switches atomically, deletes the old copy and cuts the reads over', async () => {
    const worker = await serveCatalog();
    await restoreParallel(seedNewDump);
    await worker.tick();
    await worker.tick();

    // The flip is steady state: no reimport is reported anymore, and one
    // `status` lets the server adopt the new copy without restarting.
    await expect(statusResult()).resolves.toMatchObject({ phase: 'ready' });
    const result = await statusResult();
    expect(result).not.toHaveProperty('reimport');

    // Atomic from the client's point of view: one search answers the new
    // copy wholesale, and the new Recording resolves through `getRecording`
    // (which reads Postgres, so this proves the cutover, not just the swap).
    await expect(searchMbids('Brand New Next Song')).resolves.toEqual([
      mbid(903),
    ]);
    const recording = await requestRecording(client(), { mbid: mbid(903) });
    expect(recording).toMatchObject({ ok: true });
    if (recording.ok) {
      expect(recording.result.title).toBe('Brand New Next Song');
    }

    // Lyrics were reused from our own schema, with the match rerun and no
    // new download (the LRCLIB endpoints are closed ports in this suite):
    // the unchanged take kept its Lyrics, the resized one lost them, and
    // the lyrics scope finds the carried Lyrics on the new copy.
    await expect(recordingLyrics(mbid(901))).resolves.toEqual({
      plain: 'same take la',
      synced: null,
    });
    await expect(recordingLyrics(mbid(902))).resolves.toEqual({
      plain: null,
      synced: null,
    });
    await expect(searchMbids('same take la', 'lyrics')).resolves.toEqual([
      mbid(901),
    ]);

    // The old copy is deleted: the `*_next` indexes are gone, the stale
    // backlog is dropped, and the flip record names the new database on
    // both copies.
    const meilisearch = inject('meilisearch');
    await expect(
      meilisearchRequest(meilisearch, 'GET', '/indexes/recordings_next').then(
        ({ status }) => status,
      ),
    ).resolves.toBe(404);
    await expect(
      meilisearchRequest(meilisearch, 'GET', '/indexes/lyrics_next').then(
        ({ status }) => status,
      ),
    ).resolves.toBe(404);
    await expect(statusResult()).resolves.toMatchObject({ pendingOutbox: 0 });
    const serving = await new ReimportStateRepository(server().db).get();
    expect(serving).toMatchObject({ phase: 'switched', detail: nextUrl });
    const parallelState = await new ReimportStateRepository(
      parallel().db,
    ).get();
    expect(parallelState).toMatchObject({
      phase: 'switched',
      detail: nextUrl,
    });

    // The retired database is untouched by the reimport (cleanup is off in
    // this suite): the staged Lyrics are still there.
    await expect(
      new LyricsRepository(server().db).findByMbid(mbid(901)),
    ).resolves.toEqual({ plain: 'same take la', synced: null });
  });

  it('resumes a worker restarted mid-reimport on the parallel copy', async () => {
    const worker = await serveCatalog();
    await restoreParallel(seedNewDump);

    // The crash: the first worker indexes and never comes back.
    await worker.tick();
    await expect(statusResult()).resolves.toMatchObject({
      reimport: { phase: 'switching' },
    });

    // The restart replays the switch idempotently and finishes the flip.
    const restarted = createTestWorker(server(), {
      env: {
        CATALOG_DATASET: 'full',
        LRCLIB_BASE_URL: 'http://127.0.0.1:9/',
        LRCLIB_LISTING_URL: 'http://127.0.0.1:9/',
      },
      nextCopy: { db: parallel().db, url: nextUrl },
    });
    await restarted.tick();

    await expect(searchMbids('Brand New Next Song')).resolves.toEqual([
      mbid(903),
    ]);
    await expect(statusResult()).resolves.not.toHaveProperty('reimport');
  });

  it('redoes a container run lost mid-restore without touching serving', async () => {
    const db = server().db;
    await addRecording(db, {
      mbid: mbid(921),
      name: 'Serving Survivor Song',
      lengthMs: 180_000,
    });
    await setBootstrapState(db, { phase: 'ready', dataset: 'full' });
    await setReplicationControl(db, 199_999);
    await stallReplication(db);
    let attempts = 0;
    const flaky = new ReimportRestoreService({
      bootstrap: new BootstrapService(new BootstrapRepository(db), 'full'),
      replication: replicationWith(db, async () => undefined),
      state: new ReimportStateRepository(db),
      nextState: {
        getState: () => new BootstrapRepository(parallel().db).getState(),
      },
      restore: new RestoreService({
        repository: new BootstrapRepository(parallel().db),
        mbslave: new MbslaveClient(async (args) => {
          if (args[0] === 'init') {
            await applyMusicBrainzSchema(nextUrl);
            return;
          }
          attempts += 1;
          if (attempts === 1) {
            await addRecording(parallel().db, {
              mbid: mbid(922),
              name: 'Half Restored Song',
              lengthMs: 180_000,
            });
            throw new Error('container lost mid-restore');
          }
          await seedNewDump(parallel().db);
        }),
        resolveUrls: async () => ['http://fake/mbdump.tar.bz2'],
        resolveTotalBytes: async () => undefined,
        seedTiny: async () => 0,
        baseUrl: 'http://fake/',
        dataset: 'full',
        logger: testLogger,
      }),
      currentMbslaveRef: 'v32.0.0',
      servingDatabaseUrl: inject('databaseUrl'),
      nextDatabaseUrl: nextUrl,
      dataset: 'full',
      logger: testLogger,
    });

    await expect(flaky.maybeRestore()).rejects.toThrow(
      'container lost mid-restore',
    );
    await expect(flaky.maybeRestore()).resolves.toBe('restored');

    // Redone from a clean state: the half-restored Recording is gone, the
    // new dump stands complete, and the serving copy never noticed.
    const carried = new LyricsRepository(parallel().db);
    await expect(
      carried.findMatchRecordingsByMbids([mbid(922)]),
    ).resolves.toEqual([]);
    const kept = await new ReimportStateRepository(db).get();
    expect(kept).toMatchObject({ phase: 'indexing' });
    await expect(recordingLyrics(mbid(921))).resolves.toEqual({
      plain: null,
      synced: null,
    });
  });

  it('drops a retired database through the repository', async () => {
    const admin = new Client({ connectionString: inject('databaseUrl') });
    await admin.connect();
    const name = 'music_catalog_reimport_scratch';
    try {
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.query(`CREATE DATABASE "${name}"`);

      await new ReimportStateRepository(server().db).dropDatabase(name);

      const found = await admin.query(
        'select 1 from pg_database where datname = $1',
        [name],
      );
      expect(found.rowCount).toBe(0);
    } finally {
      await admin.end();
    }
  });
});
