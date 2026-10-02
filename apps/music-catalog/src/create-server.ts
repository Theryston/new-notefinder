import type { ServerEnv, WorkerEnv } from './config/env.js';
import type { Database } from './database/database.js';
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
import { createStatusHandler } from './modules/bootstrap/bootstrap.handler.js';
import { BootstrapRepository } from './modules/bootstrap/bootstrap.repository.js';
import { BootstrapService } from './modules/bootstrap/bootstrap.service.js';
import { IndexingRepository } from './modules/indexing/indexing.repository.js';
import { IndexingService } from './modules/indexing/indexing.service.js';
import { LyricsRepository } from './modules/lyrics/lyrics.repository.js';
import { LyricsService } from './modules/lyrics/lyrics.service.js';
import { LyricsImportService } from './modules/lyrics/lyrics-import.service.js';
import { LyricsLookupService } from './modules/lyrics/lyrics-lookup.service.js';
import { LyricsRefreshRepository } from './modules/lyrics/lyrics-refresh.repository.js';
import { LyricsRefreshService } from './modules/lyrics/lyrics-refresh.service.js';
import { createGetRecordingHandler } from './modules/recording/recording.handler.js';
import { RecordingRepository } from './modules/recording/recording.repository.js';
import { RecordingService } from './modules/recording/recording.service.js';
import { RecordingDocumentRepository } from './modules/recording/recording-document.repository.js';
import { RecordingDocumentService } from './modules/recording/recording-document.service.js';
import { RecordingSummaryRepository } from './modules/recording/recording-summary.repository.js';
import { RecordingSummaryService } from './modules/recording/recording-summary.service.js';
import { ReplicationRepository } from './modules/replication/replication.repository.js';
import { ReplicationService } from './modules/replication/replication.service.js';
import { createSearchHandler } from './modules/search/search.handler.js';
import { SearchService } from './modules/search/search.service.js';
import { RecordingOutboxRepository } from './modules/sync/recording-outbox.repository.js';
import { SyncService } from './modules/sync/sync.service.js';
import { createWsServer, type WsServer } from './ws/ws-server.js';

export type CreateServerOptions = {
  env: ServerEnv;
  db: Database;
  logger: Logger;
};

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
  // The server never runs the replication loop (that is the mbslave
  // container's): it only reads the recorded sequence and the backlog for
  // `status`, so the token and the interval stay unset here.
  const replication = new ReplicationService({
    sequences: new ReplicationRepository(db),
    backlog: new RecordingOutboxRepository(db),
    mbslave: new MbslaveClient(createProcessMbslaveRun()),
    dataset: env.CATALOG_DATASET,
    logger,
  });
  const bootstrap = new BootstrapService(
    new BootstrapRepository(db),
    env.CATALOG_DATASET,
    replication,
  );
  const recording = new RecordingService(
    new RecordingRepository(db),
    bootstrap,
    new LyricsService(new LyricsRepository(db)),
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
    summaries: new RecordingSummaryService(new RecordingSummaryRepository(db)),
  });
  return createWsServer({
    port: env.PORT,
    apiKeys: env.API_KEYS,
    handlers: [
      createStatusHandler(bootstrap),
      createGetRecordingHandler(recording),
      createSearchHandler(search),
    ],
    heartbeatIntervalMs: env.HEARTBEAT_INTERVAL_MS,
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    logger,
  });
};

export type CreateWorkerOptions = {
  env: WorkerEnv;
  db: Database;
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
  const bootstrap = new BootstrapService(
    new BootstrapRepository(db),
    env.CATALOG_DATASET,
  );
  const documents = new RecordingDocumentService(
    new RecordingDocumentRepository(db),
  );
  // The worker is the only writer of the index: its key can write.
  const index = createMeilisearchIndex<RecordingDocument>({
    url: env.MEILISEARCH_URL,
    apiKey: env.MEILISEARCH_WRITE_API_KEY,
    ...RECORDINGS_INDEX,
  });
  const sync = new SyncService({
    bootstrap,
    outbox: new RecordingOutboxRepository(db),
    documents,
    index,
    batchSize: env.INDEXING_BATCH_SIZE,
    logger,
  });
  const lyrics = createWorkerLyrics({ env, db, logger, bootstrap, sync });
  const indexing = new IndexingService({
    bootstrap,
    documents,
    repository: new IndexingRepository(db),
    index,
    lyrics: {
      documents: new LyricsService(new LyricsRepository(db)),
      index: lyrics.lyricsIndex,
    },
    batchSize: env.INDEXING_BATCH_SIZE,
    logger,
  });
  // The drain runs before the initial indexing: entries the bulk has not
  // written yet wait for the next tick, so one tick never indexes the same
  // Recording twice, and a tick that finishes the bulk leaves the sync to
  // the tick after it. The Lyrics import runs between the two, while the
  // catalog is still being built: the indexing then sends the kept Lyrics
  // to the `lyrics` index in the same run, and a failed import only logs
  // (the catalog still becomes ready; the refresh below retries later).
  // Once the catalog is ready, the lookup gives outbox Recordings their
  // Lyrics from the public API before the drain carries the changes to the
  // metadata index, and the refresh imports a newer dump when one is due:
  // only changed Lyrics are reindexed, the phase never moves, and every
  // failure only logs, so `getRecording` and `search` keep answering.
  return { tick: createWorkerTick({ sync, lyrics, indexing, signal, logger }) };
};

type WorkerTickOptions = {
  sync: SyncService;
  lyrics: WorkerLyrics;
  indexing: IndexingService;
  /** Aborting it stops the tick after the step in progress. */
  signal: AbortSignal;
  logger: Logger;
};

// One round of the worker's periodic work. Steps never overlap, so the work
// a tick does needs no lock against itself.
const createWorkerTick = (
  options: WorkerTickOptions,
): (() => Promise<void>) => {
  const { sync, lyrics, indexing, signal, logger } = options;
  return async () => {
    await sync.ensureTriggers();
    try {
      await lyrics.lookupService.fillFromApi(signal);
    } catch (error) {
      logger.error('LRCLIB API lookup failed, continuing without Lyrics', {
        error,
      });
    }
    await sync.drain(signal);
    try {
      await lyrics.importService.importOnce(signal);
    } catch (error) {
      logger.error('LRCLIB import failed, continuing without Lyrics', {
        error,
      });
    }
    try {
      await lyrics.refreshService.refreshOnce(signal);
    } catch (error) {
      logger.error('LRCLIB refresh failed, serving the kept Lyrics', {
        error,
      });
    }
    await indexing.run(signal);
  };
};

type WorkerLyrics = {
  importService: LyricsImportService;
  refreshService: LyricsRefreshService;
  lookupService: LyricsLookupService;
  lyricsIndex: MeilisearchIndex<LyricsDocument>;
};

type WorkerLyricsOptions = {
  env: WorkerEnv;
  db: Database;
  logger: Logger;
  bootstrap: BootstrapService;
  sync: SyncService;
};

// The worker's Lyrics steps: the once-per-bootstrap dump import, the
// periodic refresh of newer dumps, and the API lookup for outbox Recordings
// without kept Lyrics. Built together so they share the refresh state and
// the lyrics index, which the initial indexing also writes through.
const createWorkerLyrics = (options: WorkerLyricsOptions): WorkerLyrics => {
  const { env, db, logger, bootstrap, sync } = options;
  // The worker is the only writer of the lyrics index: its key can write.
  const lyricsIndex = createMeilisearchIndex<LyricsDocument>({
    url: env.MEILISEARCH_URL,
    apiKey: env.MEILISEARCH_WRITE_API_KEY,
    ...LYRICS_INDEX,
  });
  const refreshState = new LyricsRefreshRepository(db);
  return {
    importService: new LyricsImportService({
      bootstrap,
      recordings: new LyricsRepository(db),
      dataset: env.CATALOG_DATASET,
      lrclibBaseUrl: env.LRCLIB_BASE_URL,
      lrclibListingUrl: env.LRCLIB_LISTING_URL,
      logger,
      refreshState,
    }),
    refreshService: new LyricsRefreshService({
      bootstrap,
      recordings: new LyricsRepository(db),
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
      recordings: new LyricsRepository(db),
      lyricsIndex,
      dataset: env.CATALOG_DATASET,
      apiBaseUrl: env.LRCLIB_API_BASE_URL,
      logger,
    }),
    lyricsIndex,
  };
};
