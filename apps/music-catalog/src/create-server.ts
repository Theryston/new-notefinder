import type { ServerEnv, WorkerEnv } from './config/env.js';
import type { Database } from './database/database.js';
import { createMeilisearchIndex } from './integrations/meilisearch/meilisearch-index.js';
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
import { createGetRecordingHandler } from './modules/recording/recording.handler.js';
import { RecordingRepository } from './modules/recording/recording.repository.js';
import { RecordingService } from './modules/recording/recording.service.js';
import { RecordingDocumentRepository } from './modules/recording/recording-document.repository.js';
import { RecordingDocumentService } from './modules/recording/recording-document.service.js';
import { RecordingSummaryRepository } from './modules/recording/recording-summary.repository.js';
import { RecordingSummaryService } from './modules/recording/recording-summary.service.js';
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
  const bootstrap = new BootstrapService(
    new BootstrapRepository(db),
    env.CATALOG_DATASET,
  );
  const recording = new RecordingService(
    new RecordingRepository(db),
    bootstrap,
  );
  const search = new SearchService({
    bootstrap,
    // The server only searches: its key cannot write.
    index: createMeilisearchIndex<RecordingDocument>({
      url: env.MEILISEARCH_URL,
      apiKey: env.MEILISEARCH_SEARCH_API_KEY,
      ...RECORDINGS_INDEX,
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
  const indexing = new IndexingService({
    bootstrap,
    documents,
    repository: new IndexingRepository(db),
    index,
    batchSize: env.INDEXING_BATCH_SIZE,
    logger,
  });
  const sync = new SyncService({
    bootstrap,
    outbox: new RecordingOutboxRepository(db),
    documents,
    index,
    batchSize: env.INDEXING_BATCH_SIZE,
    logger,
  });
  return {
    // The drain runs before the initial indexing: entries the bulk has not
    // written yet wait for the next tick, so one tick never indexes the same
    // Recording twice, and a tick that finishes the bulk leaves the sync to
    // the tick after it.
    tick: async () => {
      await sync.ensureTriggers();
      await sync.drain(signal);
      await indexing.run(signal);
    },
  };
};
