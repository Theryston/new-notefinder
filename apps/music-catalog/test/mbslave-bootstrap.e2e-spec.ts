import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createServer as createHttpServer,
  type Server,
  type ServerResponse,
} from 'node:http';
import { fileURLToPath } from 'node:url';
import { musicCatalogStatusResponseSchema } from '@notefinder/contracts';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import {
  GenericContainer,
  Network,
  TestContainers,
  Wait,
} from 'testcontainers';
import { createDatabase, createPool } from '../src/database/database.js';
import { bootstrapState } from '../src/database/schema/bootstrap-state.js';
import { indexingCheckpoint } from '../src/database/schema/indexing-checkpoint.js';
import type { TestServer } from './utils/create-test-server.js';
import { API_KEY, createTestServer } from './utils/create-test-server.js';
import { requestRecording } from './utils/get-recording-client.js';
import { requestSearch } from './utils/search-client.js';
import { createTestWorker } from './utils/test-worker.js';
import { connect, type TestClient } from './utils/ws-client.js';

const POSTGRES_IMAGE = 'postgres:17-alpine';
const RESTORE_TIMEOUT_MS = 180_000;
const STARTUP_TIMEOUT_MS = 180_000;
const RESTORE_VERSION = 'e2e-sample-001';
const FULL_VERSION = 'e2e-full-001';
const RECORDING_MBID = '00000000-0000-4000-8000-000000000001';
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const mbslaveContext = fileURLToPath(new URL('../mbslave/', import.meta.url));

type ArchiveResponse = 'fail' | 'sample' | 'full';

type DumpRequests = {
  sampleLatest: number;
  sampleArchive: number;
  fullLatest: number;
  fullCore: number;
  fullDerived: number;
};

const listen = (server: Server): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('The fake MusicBrainz mirror did not bind a port'));
        return;
      }
      resolve(address.port);
    });
  });

const closeHttpServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

describe('mbslave first import (e2e)', () => {
  let network: Awaited<ReturnType<Network['start']>> | undefined;
  let postgres: Awaited<ReturnType<PostgreSqlContainer['start']>> | undefined;
  let server: TestServer | undefined;
  let client: TestClient | undefined;
  let fakeMirror: Server | undefined;
  let mirrorPort: number;
  let databaseUrl: string;
  let mbslaveImage: string;
  let archiveResponse: ArchiveResponse = 'fail';
  let sampleDump: Buffer;
  let fullCoreDump: Buffer;
  let fullDerivedDump: Buffer;
  const requests: DumpRequests = {
    sampleLatest: 0,
    sampleArchive: 0,
    fullLatest: 0,
    fullCore: 0,
    fullDerived: 0,
  };

  beforeAll(async () => {
    sampleDump = await readFile(
      new URL('./fixtures/mbdump-sample.tar.xz', import.meta.url),
    );
    fullCoreDump = await readFile(
      new URL('./fixtures/mbdump.tar.bz2', import.meta.url),
    );
    fullDerivedDump = await readFile(
      new URL('./fixtures/mbdump-derived.tar.bz2', import.meta.url),
    );
    const routes = new Map<string, (response: ServerResponse) => void>([
      [
        '/sample/LATEST',
        (response) => {
          requests.sampleLatest += 1;
          response.end(`${RESTORE_VERSION}\n`);
        },
      ],
      [
        '/fullexport/LATEST',
        (response) => {
          requests.fullLatest += 1;
          response.end(`${FULL_VERSION}\n`);
        },
      ],
      [
        `/sample/${RESTORE_VERSION}/mbdump-sample.tar.xz`,
        (response) => {
          requests.sampleArchive += 1;
          if (archiveResponse === 'fail') {
            response.writeHead(503).end('temporary fixture failure');
            return;
          }
          response.end(sampleDump);
        },
      ],
      [
        `/fullexport/${FULL_VERSION}/mbdump.tar.bz2`,
        (response) => {
          requests.fullCore += 1;
          response.end(fullCoreDump);
        },
      ],
      [
        `/fullexport/${FULL_VERSION}/mbdump-derived.tar.bz2`,
        (response) => {
          requests.fullDerived += 1;
          response.end(fullDerivedDump);
        },
      ],
    ]);
    fakeMirror = createHttpServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      const route = routes.get(path);
      if (route === undefined) {
        response.writeHead(404).end('not found');
      } else {
        route(response);
      }
    });
    mirrorPort = await listen(fakeMirror);
    await TestContainers.exposeHostPorts(mirrorPort);

    network = await new Network().start();
    postgres = await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase('music_catalog')
      .withUsername('music_catalog')
      .withPassword('music_catalog')
      .withNetwork(network)
      .withNetworkAliases('music-catalog-postgres')
      .start();
    databaseUrl = postgres.getConnectionUri();
    const pool = createPool(databaseUrl, () => undefined);
    try {
      await migrate(createDatabase(pool), { migrationsFolder });
    } finally {
      await pool.end();
    }

    server = await createTestServer({ DATABASE_URL: databaseUrl });
    client = await connect(server.url, API_KEY);

    mbslaveImage = `music-catalog-mbslave:e2e-${randomUUID()}`;
    await GenericContainer.fromDockerfile(mbslaveContext, 'Dockerfile')
      .withBuildArgs({ MBSLAVE_REF: 'v31.0.1' })
      .build(mbslaveImage);
  }, STARTUP_TIMEOUT_MS + RESTORE_TIMEOUT_MS);

  afterAll(async () => {
    await client?.close();
    await server?.close();
    if (fakeMirror?.listening) {
      await closeHttpServer(fakeMirror);
    }
    await postgres?.stop();
    await network?.stop();
  });

  const status = async () => {
    if (client === undefined) {
      throw new Error('The catalog client is not connected');
    }
    const response = musicCatalogStatusResponseSchema.parse(
      await client.request('status'),
    );
    if (!response.ok) {
      throw new Error(`status failed: ${response.error.code}`);
    }
    return response.result;
  };

  const expectNotReady = async (): Promise<void> => {
    if (client === undefined) {
      throw new Error('The catalog client is not connected');
    }
    expect(
      await requestSearch(client, { query: 'restore smoke test' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'CATALOG_NOT_READY' },
    });
    expect(
      await requestRecording(client, { mbid: RECORDING_MBID }),
    ).toMatchObject({
      ok: false,
      error: { code: 'CATALOG_NOT_READY' },
    });
  };

  const runRestore = async (dataset: 'sample' | 'full'): Promise<void> => {
    if (network === undefined || postgres === undefined) {
      throw new Error('The restore test containers are not running');
    }
    const restoreLogs: string[] = [];
    const container = await new GenericContainer(mbslaveImage)
      .withNetwork(network)
      .withLogConsumer((stream) => {
        stream.on('data', (chunk) => restoreLogs.push(String(chunk)));
      })
      .withEnvironment({
        CATALOG_DATASET: dataset,
        MUSICBRAINZ_DUMP_BASE_URL: `http://host.testcontainers.internal:${mirrorPort}`,
        MBSLAVE_DB_HOST: 'music-catalog-postgres',
        MBSLAVE_DB_PORT: '5432',
        MBSLAVE_DB_DB: postgres.getDatabase(),
        MBSLAVE_DB_USER: postgres.getUsername(),
        MBSLAVE_DB_PASSWORD: postgres.getPassword(),
        MBSLAVE_DB_ADMIN_USER: postgres.getUsername(),
        MBSLAVE_DB_ADMIN_PASSWORD: postgres.getPassword(),
      })
      .withWaitStrategy(Wait.forOneShotStartup())
      .withStartupTimeout(RESTORE_TIMEOUT_MS)
      .start()
      .catch((error: unknown) => {
        throw new Error(
          `mbslave ${dataset} run failed: ${String(error)}\n${restoreLogs.join('')}`,
          { cause: error },
        );
      });
    await container.stop();
  };

  it(
    'recovers an interrupted restore, tracks indexing, skips completed data, and imports both datasets',
    async () => {
      if (client === undefined || server === undefined) {
        throw new Error('The catalog e2e server is not running');
      }
      expect(await status()).toEqual({ phase: 'restoring', dataset: 'sample' });
      await expectNotReady();

      await expect(runRestore('sample')).rejects.toThrow();
      expect(await status()).toEqual({ phase: 'restoring', dataset: 'sample' });
      await expectNotReady();

      // Represents data left in MusicBrainz by a process that died mid-restore.
      await server.db.execute(
        sql`create table musicbrainz.restore_probe (id integer not null)`,
      );
      await server.db
        .insert(indexingCheckpoint)
        .values({ indexUid: 'recordings', lastRecordingId: 123 });
      archiveResponse = 'sample';

      await runRestore('sample');

      expect(await status()).toEqual({ phase: 'restored', dataset: 'sample' });
      const probe = await server.db.execute<{ present: boolean }>(sql`
        select to_regclass('musicbrainz.restore_probe') is not null as present
      `);
      expect(probe.rows[0]?.present).toBe(false);
      expect(await server.db.select().from(indexingCheckpoint)).toHaveLength(0);
      await expectNotReady();

      const sampleRequests = { ...requests };
      await runRestore('full');
      expect(requests).toEqual(sampleRequests);
      expect(await status()).toEqual({ phase: 'restored', dataset: 'sample' });

      await server.db.delete(bootstrapState);
      await server.db.delete(indexingCheckpoint);
      await runRestore('full');
      expect(await status()).toEqual({ phase: 'restored', dataset: 'full' });
      expect(requests).toMatchObject({
        fullLatest: 1,
        fullCore: 1,
        fullDerived: 1,
      });
      await expectNotReady();

      const stoppedWorker = new AbortController();
      stoppedWorker.abort();
      await createTestWorker(server, {
        env: { DATABASE_URL: databaseUrl },
        signal: stoppedWorker.signal,
      }).tick();
      expect(await status()).toEqual({ phase: 'indexing', dataset: 'full' });
      await expectNotReady();

      await createTestWorker(server, {
        env: { DATABASE_URL: databaseUrl },
      }).tick();
      expect(await status()).toEqual({ phase: 'ready', dataset: 'full' });
      expect(
        await requestSearch(client, { query: 'restore smoke test' }),
      ).toMatchObject({ ok: true });
      expect(
        await requestRecording(client, { mbid: RECORDING_MBID }),
      ).toMatchObject({ ok: false, error: { code: 'RECORDING_NOT_FOUND' } });

      const fullRequests = { ...requests };
      await runRestore('full');
      expect(requests).toEqual(fullRequests);
      expect(await status()).toEqual({ phase: 'ready', dataset: 'full' });
    },
    RESTORE_TIMEOUT_MS * 3,
  );
});
