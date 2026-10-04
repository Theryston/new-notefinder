import { musicCatalogStatusResponseSchema } from '@notefinder/contracts';
import { inject } from 'vitest';
import type { Database } from '../../src/database/database.js';
import { MbslaveClient } from '../../src/integrations/mbslave/mbslave-client.js';
import { BootstrapRepository } from '../../src/modules/bootstrap/bootstrap.repository.js';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service.js';
import { resolveLatestDumpUrls } from '../../src/modules/bootstrap/dump-urls.js';
import { RestoreService } from '../../src/modules/bootstrap/restore.service.js';
import { LyricsRepository } from '../../src/modules/lyrics/lyrics.repository.js';
import { ReimportRestoreService } from '../../src/modules/reimport/reimport-restore.service.js';
import { ReimportStateRepository } from '../../src/modules/reimport/reimport-state.repository.js';
import { applyMusicBrainzSchema } from '../setup/musicbrainz-schema.js';
import { type TestServer, testLogger } from './create-test-server.js';
import { setBootstrapState, setReplicationControl } from './database.js';
import type { FakeDumpServer } from './fake-dump-server.js';
import { requestRecording } from './get-recording-client.js';
import { addRecording, mbid } from './musicbrainz.js';
import {
  type ParallelCopy,
  replicationWith,
  stallReplication,
} from './reimport-harness.js';
import { requestSearch } from './search-client.js';
import { createTestWorker, type TestWorker } from './test-worker.js';
import type { TestClient } from './ws-client.js';

// The per-test flows of the yearly schema-change suites: reading the catalog
// and building the two copies (see test/utils/reimport-harness.ts for the
// databases). The mbslave binary stays behind its integration boundary (a
// fake `sync` fails with the schema mismatch, a fake `init`/`import` lays the
// "new dump" into the second database), while the stall, the state machine,
// the Meilisearch swap and the cutover are the real code against the real
// Postgres, Meilisearch and WebSocket. The new dump downloads its archives
// over real HTTP from the fake dump server, like the first-import path
// does: the URL selection (`LATEST` plus archives) and the download are
// covered, only the binary's streaming into Postgres is faked (it seeds what
// the dump would load).

// Every catalog read below asserts `ok`, which is also the proof the
// service never answers `CATALOG_NOT_READY` during the reimport: any
// not-ready answer arrives as `ok: false`.
export const readStatus = async (client: TestClient) => {
  const response = musicCatalogStatusResponseSchema.parse(
    await client.request('status', {}),
  );
  if (!response.ok) {
    throw new Error(`status failed: ${response.error.code}`);
  }
  return response.result;
};

export const searchForMbids = async (
  client: TestClient,
  query: string,
  scope?: 'metadata' | 'lyrics',
): Promise<string[]> => {
  const response = await requestSearch(
    client,
    scope === undefined ? { query } : { query, scope },
  );
  if (!response.ok) {
    throw new Error(`search failed: ${response.error.code}`);
  }
  return response.result.results.map((result) => result.mbid);
};

const readRecordingLyrics = async (
  client: TestClient,
  recordingMbid: string,
) => {
  const response = await requestRecording(client, { mbid: recordingMbid });
  if (!response.ok) {
    throw new Error(
      `getRecording failed: ${response.error.code} for ${recordingMbid}`,
    );
  }
  return response.result.lyrics;
};

export type ParallelRestoreOptions = {
  /** The serving copy's import state, stall and reimport state. */
  servingDb: Database;
  /** The serving database URL, never restored into. */
  servingUrl: string;
  /** The parallel copy with its URL. */
  next: ParallelCopy;
  /** The dump base URL (the fake dump server in tests). */
  dumpsUrl: string;
  /** Seeds what the new dump would load. */
  seed?: (db: Database) => Promise<void>;
};

export const restoreParallelInto = async (
  options: ParallelRestoreOptions,
): Promise<'restored'> => {
  const { servingDb, servingUrl, next, dumpsUrl, seed } = options;
  const { db } = next;
  const mbslave = new MbslaveClient(async (args) => {
    if (args[0] === 'init') {
      await applyMusicBrainzSchema(next.url);
      return;
    }
    if (args[0] === 'import') {
      for (const url of args.slice(1)) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `The fake dump server answered ${response.status} for ${url}`,
          );
        }
        await response.arrayBuffer();
      }
      await seed?.(db);
      return;
    }
    throw new Error(`unexpected mbslave call: ${args.join(' ')}`);
  });
  const container = new ReimportRestoreService({
    bootstrap: new BootstrapService(new BootstrapRepository(servingDb), 'full'),
    replication: replicationWith(servingDb, async () => undefined),
    state: new ReimportStateRepository(servingDb),
    nextState: {
      getState: () => new BootstrapRepository(db).getState(),
    },
    restore: new RestoreService({
      repository: new BootstrapRepository(db),
      mbslave,
      resolveUrls: resolveLatestDumpUrls,
      resolveTotalBytes: async () => undefined,
      seedTiny: async () => 0,
      baseUrl: dumpsUrl,
      dataset: 'full',
      logger: testLogger,
    }),
    currentMbslaveRef: 'v32.0.0',
    servingDatabaseUrl: servingUrl,
    nextDatabaseUrl: next.url,
    dataset: 'full',
    logger: testLogger,
  });
  const outcome = await container.maybeRestore();
  expect(outcome).toBe('restored');
  return 'restored';
};

// The serving copy of the flow tests: three Recordings, two with kept
// Lyrics, indexed and `ready`, with replication stalled on the schema
// change. A closed port answers the LRCLIB listing, so any download attempt
// fails the tick instead of hiding: the reimport must never download Lyrics
// again.
const serveCatalogFlow = async (
  server: TestServer,
  parallel: ParallelCopy,
): Promise<TestWorker> => {
  const db = server.db;
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
  const worker = createTestWorker(server, {
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
  // The flow suites opt out of the default cleanup: their flip must never
  // drop the shared e2e database (the default path has its own suite on
  // scratch databases, reimport-cleanup).
  return createTestWorker(server, {
    env: {
      CATALOG_DATASET: 'full',
      LRCLIB_BASE_URL: 'http://127.0.0.1:9/',
      LRCLIB_LISTING_URL: 'http://127.0.0.1:9/',
      REIMPORT_CLEANUP_OLD_COPY: 'false',
    },
    nextCopy: { db: parallel.db, url: parallel.url },
  });
};

export type ReimportFlow = {
  statusResult: () => ReturnType<typeof readStatus>;
  searchMbids: (
    query: string,
    scope?: 'metadata' | 'lyrics',
  ) => Promise<string[]>;
  recordingLyrics: (
    recordingMbid: string,
  ) => ReturnType<typeof readRecordingLyrics>;
  serveCatalog: () => Promise<TestWorker>;
  restoreParallel: (
    seed?: (db: Database) => Promise<void>,
  ) => Promise<'restored'>;
};

// The per-test flows against one isolated server: reading the catalog and
// building the two copies.
export const useReimportFlow = (options: {
  server: () => TestServer;
  client: () => TestClient;
  parallel?: () => ParallelCopy;
  dumps?: () => FakeDumpServer;
}): ReimportFlow => {
  const { server, client, parallel, dumps } = options;
  const needParallel = (): ParallelCopy => {
    if (parallel === undefined) {
      throw new Error('This suite has no parallel database');
    }
    return parallel();
  };
  const needDumps = (): FakeDumpServer => {
    if (dumps === undefined) {
      throw new Error('This suite has no fake dump server');
    }
    return dumps();
  };
  return {
    statusResult: () => readStatus(client()),
    searchMbids: (query: string, scope?: 'metadata' | 'lyrics') =>
      searchForMbids(client(), query, scope),
    recordingLyrics: (recordingMbid: string) =>
      readRecordingLyrics(client(), recordingMbid),
    serveCatalog: () => serveCatalogFlow(server(), needParallel()),
    restoreParallel: (seed?: (db: Database) => Promise<void>) =>
      restoreParallelInto({
        servingDb: server().db,
        servingUrl: inject('databaseUrl'),
        next: needParallel(),
        dumpsUrl: needDumps().url,
        seed,
      }),
  };
};
