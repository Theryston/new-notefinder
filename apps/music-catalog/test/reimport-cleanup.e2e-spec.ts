import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { inject } from 'vitest';
import { parseServerEnv, parseWorkerEnv } from '../src/config/env.js';
import {
  createMusicCatalogServer,
  createMusicCatalogWorker,
} from '../src/create-server.js';
import type { Database } from '../src/database/database.js';
import { createDatabase, createPool } from '../src/database/database.js';
import {
  REIMPORT_GENERATION_INDEX,
  REIMPORT_GENERATION_NEXT_INDEX,
} from '../src/lib/reimport-generation-index.js';
import { readReimportStateOf } from '../src/modules/reimport/read-reimport-state.js';
import { ReimportStateRepository } from '../src/modules/reimport/reimport-state.repository.js';
import { resolveServingDatabaseUrl } from '../src/modules/reimport/resolve-serving-url.js';
import { TrackAssociationRepository } from '../src/modules/track-association/track-association.repository.js';
import { TrackAssociationService } from '../src/modules/track-association/track-association.service.js';
import { applyMusicBrainzSchema } from './setup/musicbrainz-schema.js';
import { API_KEY, testLogger } from './utils/create-test-server.js';
import { setBootstrapState, setReplicationControl } from './utils/database.js';
import { meilisearchRequest } from './utils/meilisearch-http.js';
import { addRecording, mbid } from './utils/musicbrainz.js';
import {
  readStatus,
  restoreParallelInto,
  searchForMbids,
} from './utils/reimport-flows.js';
import {
  type ParallelCopy,
  seedNewDump,
  stallReplication,
  useFakeDumps,
} from './utils/reimport-harness.js';
import { requestSearch } from './utils/search-client.js';
import { requestTrackAssociation } from './utils/track-association-client.js';
import { connect, type TestClient } from './utils/ws-client.js';

// The yearly schema change: the retired copy is deleted by default (see
// test/utils/reimport-harness.ts for the shared setup). This suite runs on
// scratch databases, never the shared e2e one: the flip drops the serving
// database, so the next test could not boot against it anymore.
describe('yearly schema change: deleting the retired copy (e2e)', {
  timeout: 120_000,
}, () => {
  const dumps = useFakeDumps();

  // Scratch serving and parallel databases, migrated with the MusicBrainz
  // schema like the container leaves them.
  let serveUrl = '';
  let nextUrl = '';
  let serveDb: Database | undefined;
  let nextDb: Database | undefined;
  const pools: Array<{ end: () => Promise<void> }> = [];

  const scratchUrl = (suffix: string): string => {
    const url = new URL(inject('databaseUrl'));
    url.pathname = `${url.pathname.replace(/\/$/, '')}_${suffix}`;
    return url.toString();
  };

  const databaseNameOf = (url: string): string =>
    new URL(url).pathname.replace(/^\//, '');

  const createScratchDatabase = async (url: string): Promise<void> => {
    const admin = new Client({ connectionString: inject('databaseUrl') });
    await admin.connect();
    try {
      const name = databaseNameOf(url);
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.query(`CREATE DATABASE "${name}"`);
    } finally {
      await admin.end();
    }
    const pool = createPool(url, () => undefined);
    pools.push(pool);
    const db = createDatabase(pool);
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
    await applyMusicBrainzSchema(url);
    if (url === serveUrl) {
      serveDb = db;
    } else {
      nextDb = db;
    }
  };

  const dropScratchDatabase = async (url: string): Promise<void> => {
    const admin = new Client({ connectionString: inject('databaseUrl') });
    await admin.connect();
    try {
      const name = databaseNameOf(url);
      await admin.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1',
        [name],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    } finally {
      await admin.end();
    }
  };

  beforeAll(async () => {
    serveUrl = scratchUrl('reimport_serve');
    nextUrl = scratchUrl('reimport_next');
    await createScratchDatabase(serveUrl);
    await createScratchDatabase(nextUrl);
  });

  afterAll(async () => {
    for (const pool of pools) {
      await pool.end();
    }
    pools.length = 0;
    await dropScratchDatabase(serveUrl);
    await dropScratchDatabase(nextUrl);
  });

  beforeEach(async () => {
    // Fire and forget: Meilisearch runs tasks in order, so deletes queued
    // here finish before anything the test enqueues.
    const meilisearch = inject('meilisearch');
    void meilisearchRequest(meilisearch, 'DELETE', '/indexes/recordings');
    void meilisearchRequest(meilisearch, 'DELETE', '/indexes/recordings_next');
    void meilisearchRequest(
      meilisearch,
      'DELETE',
      `/indexes/${REIMPORT_GENERATION_INDEX.uid}`,
    );
    void meilisearchRequest(
      meilisearch,
      'DELETE',
      `/indexes/${REIMPORT_GENERATION_NEXT_INDEX.uid}`,
    );
  });

  // A server booted like `server.ts`: the flip record (or its absence)
  // decides which database opens.
  const bootServerOn = async (
    configuredUrl: string,
    reimportUrl?: string,
    next?: ParallelCopy,
  ): Promise<{
    servingUrl: string;
    client: TestClient;
    stop: () => Promise<void>;
  }> => {
    const meilisearch = inject('meilisearch');
    const resolved = await resolveServingDatabaseUrl({
      configuredUrl,
      reimportUrl,
      readReimportState: (url) => readReimportStateOf(url, () => undefined),
    });
    const env = parseServerEnv({
      NODE_ENV: 'test',
      PORT: '0',
      DATABASE_URL: configuredUrl,
      API_KEYS: API_KEY,
      CATALOG_DATASET: 'full',
      MEILISEARCH_URL: meilisearch.url,
      MEILISEARCH_SEARCH_API_KEY: meilisearch.searchKey,
      ...(reimportUrl === undefined
        ? {}
        : { REIMPORT_DATABASE_URL: reimportUrl }),
    });
    const pool = createPool(resolved, () => undefined);
    pools.push(pool);
    const ws = createMusicCatalogServer({
      env,
      db: createDatabase(pool),
      servingDatabaseUrl: resolved,
      ...(next === undefined ? {} : { nextCopy: next }),
      logger: testLogger,
      searchReadinessRefreshIntervalMs: 10,
      onSearchReadinessCreated: (readiness) => {
        const start = readiness.start.bind(readiness);
        // This fixture exercises cleanup and restart. Live adoption is
        // covered by reimport-switch; no background reader should outlive
        // the scratch database that this scenario deliberately deletes.
        vi.spyOn(readiness, 'start').mockImplementationOnce(async () => {
          await start();
          await readiness.stop();
        });
      },
    });
    const { port } = await ws.start();
    const tcp = await connect(`ws://127.0.0.1:${port}`, API_KEY);
    return {
      servingUrl: resolved,
      client: tcp,
      stop: async () => {
        await tcp.close();
        await ws.stop();
        await pool.end();
        pools.splice(pools.indexOf(pool), 1);
      },
    };
  };

  // A worker booted like `worker.ts`, without the loop: one `tick` per call.
  // `REIMPORT_CLEANUP_OLD_COPY` is deliberately unset: the default path
  // drops the retired copy.
  const bootWorkerOn = async (
    configuredUrl: string,
    next: ParallelCopy | undefined,
  ): Promise<{ tick: () => Promise<void> }> => {
    const meilisearch = inject('meilisearch');
    const servingUrl = await resolveServingDatabaseUrl({
      configuredUrl,
      reimportUrl: next?.url,
      readReimportState: (url) => readReimportStateOf(url, () => undefined),
    });
    const pool = createPool(servingUrl, () => undefined);
    pools.push(pool);
    const nextPool =
      next === undefined ? undefined : createPool(next.url, () => undefined);
    if (nextPool !== undefined) {
      pools.push(nextPool);
    }
    const worker = createMusicCatalogWorker({
      env: parseWorkerEnv({
        NODE_ENV: 'test',
        DATABASE_URL: configuredUrl,
        API_KEYS: API_KEY,
        CATALOG_DATASET: 'full',
        MEILISEARCH_URL: meilisearch.url,
        MEILISEARCH_WRITE_API_KEY: meilisearch.writeKey,
        ...(next === undefined ? {} : { REIMPORT_DATABASE_URL: next.url }),
      }),
      db: createDatabase(pool),
      nextCopy:
        next === undefined || nextPool === undefined
          ? undefined
          : { db: createDatabase(nextPool), url: next.url },
      logger: testLogger,
      signal: new AbortController().signal,
    });
    return worker;
  };

  const databaseExists = async (url: string): Promise<boolean> => {
    const admin = new Client({ connectionString: inject('databaseUrl') });
    await admin.connect();
    try {
      const found = await admin.query(
        'select 1 from pg_database where datname = $1',
        [databaseNameOf(url)],
      );
      return (found.rowCount ?? 0) > 0;
    } finally {
      await admin.end();
    }
  };

  it('drops a retired database through the repository', async () => {
    const admin = new Client({ connectionString: inject('databaseUrl') });
    await admin.connect();
    const name = 'music_catalog_reimport_scratch';
    const pool = createPool(inject('databaseUrl'), () => undefined);
    try {
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.query(`CREATE DATABASE "${name}"`);

      const db = createDatabase(pool);
      await new ReimportStateRepository(db).dropDatabase(name);

      const found = await admin.query(
        'select 1 from pg_database where datname = $1',
        [name],
      );
      expect(found.rowCount).toBe(0);
    } finally {
      await pool.end();
      await admin.end();
    }
  });

  it('drops the retired database by default and restarts onto the new copy', async () => {
    if (serveDb === undefined || nextDb === undefined) {
      throw new Error('The scratch databases are only available inside a test');
    }
    const serving = serveDb;
    const next = { db: nextDb, url: nextUrl };

    await addRecording(serving, {
      mbid: mbid(901),
      name: 'Same Take Song',
      lengthMs: 180_000,
    });
    await addRecording(serving, {
      mbid: mbid(902),
      name: 'Resized Take Song',
      lengthMs: 180_000,
    });
    await setBootstrapState(serving, { phase: 'restored', dataset: 'full' });
    await setReplicationControl(serving, 199_999);
    const worker = await bootWorkerOn(serveUrl, next);
    await worker.tick();
    await stallReplication(serving);
    const server = await bootServerOn(serveUrl, nextUrl, next);
    const retainedTrackId = '00000000-0000-4000-8000-000000000301';
    const inFlightTrackId = '00000000-0000-4000-8000-000000000302';
    const postCutoverTrackId = '00000000-0000-4000-8000-000000000303';
    await requestTrackAssociation(server.client, {
      mbid: mbid(901),
      trackId: retainedTrackId,
    });

    await restoreParallelInto({
      servingDb: serving,
      servingUrl: serveUrl,
      next,
      dumpsUrl: dumps().url,
      seed: seedNewDump,
      associations: new TrackAssociationService(
        new TrackAssociationRepository(serving, serveUrl),
      ),
    });
    await requestTrackAssociation(server.client, {
      mbid: mbid(903),
      trackId: inFlightTrackId,
    });
    await server.stop();
    await worker.tick();
    // The default cleanup drops the retired database on the flip. The flip
    // itself completed; the tick's later steps then fail on the dropped
    // database until the processes restart (the runbook below), so the
    // production loop logs this error and retries.
    await expect(worker.tick()).rejects.toThrow();

    await expect(databaseExists(serveUrl)).resolves.toBe(false);
    await expect(databaseExists(nextUrl)).resolves.toBe(true);
    await expect(
      new ReimportStateRepository(nextDb).get(),
    ).resolves.toMatchObject({ phase: 'switched', detail: nextUrl });

    // The runbook restarts the processes: the boot fallback opens the new
    // copy instead of the dropped configured one, for the server and the
    // worker alike. The restarted worker finishes the first import's
    // phases on the new copy.
    const restarted = await bootWorkerOn(serveUrl, next);
    await expect(restarted.tick()).resolves.toBeUndefined();
    const servingServer = await bootServerOn(serveUrl, nextUrl, next);
    try {
      expect(servingServer.servingUrl).toBe(nextUrl);
      await expect(readStatus(servingServer.client)).resolves.toMatchObject({
        phase: 'ready',
      });
      await expect(
        searchForMbids(servingServer.client, 'Brand New Next Song'),
      ).resolves.toEqual([mbid(903)]);
      await expect(
        requestSearch(servingServer.client, { query: 'Same Take Song' }),
      ).resolves.toMatchObject({
        ok: true,
        result: { results: [{ mbid: mbid(901), trackId: retainedTrackId }] },
      });
      await expect(
        requestSearch(servingServer.client, { query: 'Brand New Next Song' }),
      ).resolves.toMatchObject({
        ok: true,
        result: { results: [{ mbid: mbid(903), trackId: inFlightTrackId }] },
      });
      await requestTrackAssociation(servingServer.client, {
        mbid: mbid(904),
        trackId: postCutoverTrackId,
      });
      await restarted.tick();
      await expect(
        requestSearch(servingServer.client, { query: 'Steady Control Song' }),
      ).resolves.toMatchObject({
        ok: true,
        result: { results: [{ mbid: mbid(904), trackId: postCutoverTrackId }] },
      });
    } finally {
      await servingServer.stop();
    }
  });
});
