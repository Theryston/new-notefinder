import type { CatalogDataset } from '@notefinder/contracts';
import type { ServerEnv, WorkerEnv } from './config/env.js';
import { createCutoverWatcher } from './cutover-watcher.js';
import type { Database } from './database/database.js';
import { openCutoverDatabase } from './database/database-ref.js';
import {
  createProcessMbslaveRun,
  MbslaveClient,
} from './integrations/mbslave/mbslave-client.js';
import { createMeilisearchIndex } from './integrations/meilisearch/meilisearch-index.js';
import {
  RECORDINGS_INDEX,
  type RecordingDocument,
} from './lib/recordings-index.js';
import type { Logger } from './logger.js';
import { createGetArtistHandler } from './modules/artist/artist.handler.js';
import { ArtistRepository } from './modules/artist/artist.repository.js';
import { ArtistService } from './modules/artist/artist.service.js';
import { createStatusHandler } from './modules/bootstrap/bootstrap.handler.js';
import { BootstrapRepository } from './modules/bootstrap/bootstrap.repository.js';
import type { ReplicationStatusSource } from './modules/bootstrap/bootstrap.service.js';
import { BootstrapService } from './modules/bootstrap/bootstrap.service.js';
import { createGetRecordingHandler } from './modules/recording/recording.handler.js';
import { RecordingRepository } from './modules/recording/recording.repository.js';
import { RecordingService } from './modules/recording/recording.service.js';
import { RecordingSummaryRepository } from './modules/recording/recording-summary.repository.js';
import { RecordingSummaryService } from './modules/recording/recording-summary.service.js';
import { readReimportStatus } from './modules/reimport/reimport.service.js';
import { ReimportStateRepository } from './modules/reimport/reimport-state.repository.js';
import { createGetReleaseGroupHandler } from './modules/release-group/release-group.handler.js';
import { ReleaseGroupRepository } from './modules/release-group/release-group.repository.js';
import { ReleaseGroupService } from './modules/release-group/release-group.service.js';
import { ReplicationRepository } from './modules/replication/replication.repository.js';
import { ReplicationService } from './modules/replication/replication.service.js';
import { createSearchHandler } from './modules/search/search.handler.js';
import { SearchService } from './modules/search/search.service.js';
import { SearchReadiness } from './modules/search/search-readiness.js';
import { RecordingOutboxRepository } from './modules/sync/recording-outbox.repository.js';
import { assembleWorkerReimport } from './reimport-wiring.js';
import { buildServingIndexing } from './worker/indexing-stack.js';
import { createWorkerTick } from './worker/worker-tick.js';
import type { Handler } from './ws/handler.js';
import { createWsServer, type WsServer } from './ws/ws-server.js';

const SEARCH_READINESS_REFRESH_INTERVAL_MS = 5000;
const SEARCH_READINESS_QUERY_TIMEOUT_MS = 5000;

export type CreateServerOptions = {
  env: ServerEnv;
  db: Database;
  logger: Logger;
  /** Test-only timing override; production uses the five-second interval. */
  searchReadinessRefreshIntervalMs?: number;
  /** Exposes the cache to e2e setup so tests can await phase propagation. */
  onSearchReadinessCreated?: (readiness: SearchReadiness) => void;
};

/**
 * The cutover shared by a process's repositories: every repository resolves
 * it on every query, so flipping `current` moves the reads to the
 * reimported copy without restarting. In-flight requests finish on the
 * database object they started with.
 */
type DatabaseRef = {
  current: Database;
};

type ServingBootstrapOptions = {
  dbSource: () => Database;
  dataset: CatalogDataset;
  /** The server reports replication; the worker has no loop to report. */
  replication?: ReplicationStatusSource;
  openDatabase: (url: string) => Database;
  adopt: (db: Database) => void;
  logger: Logger;
};

// The bootstrap both processes read the catalog through: the first
// import's state with the reimport progress and the cutover beside it.
// Shared by the server and the worker roots, which differ only in what
// they report and open.
const createServingBootstrap = (
  options: ServingBootstrapOptions,
): {
  bootstrap: BootstrapService;
  reimportState: ReimportStateRepository;
} => {
  const reimportState = new ReimportStateRepository(options.dbSource);
  const bootstrap = new BootstrapService(
    new BootstrapRepository(options.dbSource),
    options.dataset,
    options.replication,
    {
      status: {
        reportReimport: () => readReimportStatus(reimportState),
      },
      cutover: createCutoverWatcher({
        readState: (queryTimeoutMs) => reimportState.get(queryTimeoutMs),
        openDatabase: options.openDatabase,
        adopt: options.adopt,
        logger: options.logger,
      }),
    },
  );
  return { bootstrap, reimportState };
};

// The reads that answer one entity by MBID (a release group, an artist),
// wired the same way as the Recording's.
const createEntityHandlers = (
  dbSource: () => Database,
  bootstrap: BootstrapService,
): Handler[] => [
  createGetReleaseGroupHandler(
    new ReleaseGroupService(new ReleaseGroupRepository(dbSource), bootstrap),
  ),
  createGetArtistHandler(
    new ArtistService(new ArtistRepository(dbSource), bootstrap),
  ),
];

const createServerSearch = (options: {
  bootstrap: BootstrapService;
  env: ServerEnv;
  dbSource: () => Database;
  logger: Logger;
  refreshIntervalMs: number;
}): { search: SearchService; readiness: SearchReadiness } => {
  const { bootstrap, env, dbSource, logger, refreshIntervalMs } = options;
  const readiness = new SearchReadiness({
    readPhase: () =>
      bootstrap.getImportPhase({
        queryTimeoutMs: SEARCH_READINESS_QUERY_TIMEOUT_MS,
      }),
    refreshIntervalMs,
    logger,
  });
  const search = new SearchService({
    readiness,
    index: createMeilisearchIndex<RecordingDocument>({
      url: env.MEILISEARCH_URL,
      apiKey: env.MEILISEARCH_SEARCH_API_KEY,
      ...RECORDINGS_INDEX,
    }),
    summaries: new RecordingSummaryService(
      new RecordingSummaryRepository(dbSource),
    ),
  });
  return { search, readiness };
};

export const withSearchReadiness = (
  server: WsServer,
  readiness: SearchReadiness,
): WsServer => ({
  start: async () => {
    try {
      await readiness.start();
      return await server.start();
    } catch (error) {
      await Promise.allSettled([readiness.stop(), server.stop()]);
      throw error;
    }
  },
  stop: async () =>
    Promise.all([readiness.stop(), server.stop()]).then(() => undefined),
});

/**
 * The composition root of the server process: builds each module's
 * repository, service and handler, and hands the handlers to the WebSocket
 * server. Shared by `server.ts` and the e2e tests, so they run the same
 * wiring.
 */
export const createMusicCatalogServer = (
  options: CreateServerOptions,
): WsServer => {
  const { env, db, logger } = options;
  // Every repository reads through the reference, so the cutover watcher
  // can flip the process to the reimported copy without restarting it.
  const dbRef: DatabaseRef = { current: db };
  const dbSource = (): Database => dbRef.current;
  // The server never runs the replication loop (that is the mbslave
  // container's): it only reads the recorded sequence and the backlog for
  // `status`, so the token and the interval stay unset here. It reads the
  // stall through the same repository, so a schema change shows while the
  // container crash-loops (it never records or clears one from here).
  const sequences = new ReplicationRepository(dbSource);
  const replication = new ReplicationService({
    sequences,
    backlog: new RecordingOutboxRepository(dbSource),
    mbslave: new MbslaveClient(createProcessMbslaveRun()),
    dataset: env.CATALOG_DATASET,
    stalls: sequences,
    logger,
  });
  const { bootstrap } = createServingBootstrap({
    dbSource,
    dataset: env.CATALOG_DATASET,
    replication,
    openDatabase: (url) => openCutoverDatabase(url, logger),
    adopt: (database) => {
      dbRef.current = database;
    },
    logger,
  });
  const recording = new RecordingService(
    new RecordingRepository(dbSource),
    bootstrap,
  );
  const { search, readiness: searchReadiness } = createServerSearch({
    bootstrap,
    env,
    dbSource,
    logger,
    refreshIntervalMs:
      options.searchReadinessRefreshIntervalMs ??
      SEARCH_READINESS_REFRESH_INTERVAL_MS,
  });
  options.onSearchReadinessCreated?.(searchReadiness);
  const wsServer = createWsServer({
    port: env.PORT,
    apiKeys: env.API_KEYS,
    handlers: [
      createStatusHandler(bootstrap),
      createGetRecordingHandler(recording),
      createSearchHandler(search),
      ...createEntityHandlers(dbSource, bootstrap),
    ],
    heartbeatIntervalMs: env.HEARTBEAT_INTERVAL_MS,
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    logger,
  });
  return withSearchReadiness(wsServer, searchReadiness);
};

export type CreateWorkerOptions = {
  env: WorkerEnv;
  db: Database;
  /**
   * The parallel database of a running reimport with its URL. Absent, the
   * worker never reimports (see `REIMPORT_DATABASE_URL`).
   */
  nextCopy?: { db: Database; url: string };
  logger: Logger;
  /** Aborted when the process is asked to stop. */
  signal: AbortSignal;
};

export type MusicCatalogWorker = {
  /** One round of the worker's periodic work. */
  tick: () => Promise<void>;
};

/**
 * The composition root of the worker process, next to the server's: shared
 * by `worker.ts` and the e2e tests, so they run the same wiring. Each step
 * the worker gains plugs into `tick`.
 */
export const createMusicCatalogWorker = (
  options: CreateWorkerOptions,
): MusicCatalogWorker => {
  const { env, db, logger, signal } = options;
  const dbRef: DatabaseRef = { current: db };
  const dbSource = (): Database => dbRef.current;
  const { bootstrap, reimportState } = createServingBootstrap({
    dbSource,
    dataset: env.CATALOG_DATASET,
    openDatabase: (url) => {
      const next = options.nextCopy;
      return next !== undefined && next.url === url
        ? next.db
        : openCutoverDatabase(url, logger);
    },
    adopt: (database) => {
      dbRef.current = database;
    },
    logger,
  });
  const indexing = buildServingIndexing({
    bootstrap,
    dbSource,
    meilisearchUrl: env.MEILISEARCH_URL,
    writeApiKey: env.MEILISEARCH_WRITE_API_KEY,
    batchSize: env.INDEXING_BATCH_SIZE,
    logger,
  });
  const reimport = assembleWorkerReimport({
    bootstrap,
    state: reimportState,
    dataset: env.CATALOG_DATASET,
    logger,
    dbSource,
    index: indexing.index,
    env,
    nextCopy: options.nextCopy,
  });
  const tick = createWorkerTick({
    reimport,
    sync: indexing.sync,
    indexing: indexing.indexing,
    signal,
  });
  return {
    // The reimport step runs first: while one is active the serving copy
    // keeps being drained and searched below, and the first import's phase
    // stays `ready` throughout. The drain runs before the initial indexing:
    // entries the bulk has not written yet wait for the next tick, so one
    // tick never indexes the same Recording twice, and a tick that finishes
    // the bulk leaves the sync to the tick after it.
    tick,
  };
};
