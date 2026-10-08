import type { CatalogDataset } from '@notefinder/contracts';
import type { ServerEnv, WorkerEnv } from './config/env.js';
import { createCutoverWatcher } from './cutover-watcher.js';
import type { Database } from './database/database.js';
import { openCutoverDatabase } from './database/database-ref.js';
import {
  createProcessMbslaveRun,
  MbslaveClient,
} from './integrations/mbslave/mbslave-client.js';
import {
  createMeilisearchIndex,
  type MeilisearchIndex,
} from './integrations/meilisearch/meilisearch-index.js';
import { LYRICS_INDEX, type LyricsDocument } from './lib/lyrics-index.js';
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
import { LyricsRepository } from './modules/lyrics/lyrics.repository.js';
import { LyricsService } from './modules/lyrics/lyrics.service.js';
import { LyricsImportService } from './modules/lyrics/lyrics-import.service.js';
import { LyricsLookupService } from './modules/lyrics/lyrics-lookup.service.js';
import { LyricsRefreshRepository } from './modules/lyrics/lyrics-refresh.repository.js';
import { LyricsRefreshService } from './modules/lyrics/lyrics-refresh.service.js';
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
import { RecordingOutboxRepository } from './modules/sync/recording-outbox.repository.js';
import type { SyncService } from './modules/sync/sync.service.js';
import { assembleWorkerReimport } from './reimport-wiring.js';
import { buildServingIndexing } from './worker/indexing-stack.js';
import { createWorkerTick } from './worker/worker-tick.js';
import type { Handler } from './ws/handler.js';
import { createWsServer, type WsServer } from './ws/ws-server.js';

export type CreateServerOptions = {
  env: ServerEnv;
  db: Database;
  logger: Logger;
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
        readState: () => reimportState.get(),
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
    new LyricsService(new LyricsRepository(dbSource)),
  );
  const search = new SearchService({
    bootstrap,
    // The server only searches: its key cannot write.
    index: createMeilisearchIndex<RecordingDocument>({
      url: env.MEILISEARCH_URL,
      apiKey: env.MEILISEARCH_SEARCH_API_KEY,
      ...RECORDINGS_INDEX,
    }),
    lyricsIndex: createMeilisearchIndex<LyricsDocument>({
      url: env.MEILISEARCH_URL,
      apiKey: env.MEILISEARCH_SEARCH_API_KEY,
      ...LYRICS_INDEX,
    }),
    summaries: new RecordingSummaryService(
      new RecordingSummaryRepository(dbSource),
    ),
  });
  return createWsServer({
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
 * the worker gains (Lyrics) plugs into `tick`.
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
  const lyrics = createWorkerLyrics({
    env,
    dbSource,
    logger,
    bootstrap,
    sync: indexing.sync,
    lyricsIndex: indexing.lyricsIndex,
  });
  const reimport = assembleWorkerReimport({
    bootstrap,
    state: reimportState,
    dataset: env.CATALOG_DATASET,
    logger,
    dbSource,
    index: indexing.index,
    lyricsIndex: indexing.lyricsIndex,
    env,
    nextCopy: options.nextCopy,
  });
  const tick = createWorkerTick({
    reimport,
    sync: indexing.sync,
    lyrics,
    indexing: indexing.indexing,
    signal,
    logger,
  });
  return {
    // The reimport step runs first: while one is active the serving copy
    // keeps being drained and searched below, and the first import's phase
    // stays `ready` throughout. The drain runs before the initial indexing:
    // entries the bulk has not written yet wait for the next tick, so one
    // tick never indexes the same Recording twice, and a tick that finishes
    // the bulk leaves the sync to the tick after it. The Lyrics import runs
    // between the two, while the catalog is still being built: the indexing
    // then sends the kept Lyrics to the `lyrics` index in the same run, and
    // a failed import only logs (the catalog still becomes ready; the
    // refresh below retries later). Once the catalog is ready, the lookup
    // peeks the outbox Recordings without Lyrics before the drain and asks
    // the public API for them after it, so a slow or failing API never holds
    // the drain back, and the refresh imports a newer dump when one is due:
    // only changed Lyrics are reindexed, the phase never moves, and every
    // failure only logs, so `getRecording` and `search` keep answering.
    tick,
  };
};

type WorkerLyrics = {
  importService: LyricsImportService;
  refreshService: LyricsRefreshService;
  lookupService: LyricsLookupService;
};

type WorkerLyricsOptions = {
  env: WorkerEnv;
  dbSource: () => Database;
  logger: Logger;
  bootstrap: BootstrapService;
  sync: SyncService;
  lyricsIndex: MeilisearchIndex<LyricsDocument>;
};

// The worker's Lyrics steps: the once-per-bootstrap dump import, the
// periodic refresh of newer dumps, and the API lookup for outbox Recordings
// without kept Lyrics. Built together so they share the refresh state and
// the lyrics index, which the initial indexing also writes through. Every
// repository reads through the cutover reference, so the steps follow the
// flip to the reimported copy without restarting.
const createWorkerLyrics = (options: WorkerLyricsOptions): WorkerLyrics => {
  const { env, dbSource, logger, bootstrap, sync, lyricsIndex } = options;
  const refreshState = new LyricsRefreshRepository(dbSource);
  return {
    importService: new LyricsImportService({
      bootstrap,
      recordings: new LyricsRepository(dbSource),
      dataset: env.CATALOG_DATASET,
      lrclibBaseUrl: env.LRCLIB_BASE_URL,
      lrclibListingUrl: env.LRCLIB_LISTING_URL,
      logger,
      refreshState,
    }),
    refreshService: new LyricsRefreshService({
      bootstrap,
      recordings: new LyricsRepository(dbSource),
      refreshState,
      lyricsIndex,
      dataset: env.CATALOG_DATASET,
      lrclibBaseUrl: env.LRCLIB_BASE_URL,
      lrclibListingUrl: env.LRCLIB_LISTING_URL,
      checkIntervalMs: env.LRCLIB_REFRESH_CHECK_INTERVAL_MS,
      minIntervalDays: env.LRCLIB_REFRESH_MIN_INTERVAL_DAYS,
      logger,
    }),
    lookupService: new LyricsLookupService({
      bootstrap,
      sync,
      recordings: new LyricsRepository(dbSource),
      lyricsIndex,
      dataset: env.CATALOG_DATASET,
      apiBaseUrl: env.LRCLIB_API_BASE_URL,
      logger,
    }),
  };
};
