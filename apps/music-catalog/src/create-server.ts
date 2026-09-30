import type { Env } from './config/env.js';
import type { Database } from './database/database.js';
import type { Logger } from './logger.js';
import { createStatusHandler } from './modules/bootstrap/bootstrap.handler.js';
import { BootstrapRepository } from './modules/bootstrap/bootstrap.repository.js';
import { BootstrapService } from './modules/bootstrap/bootstrap.service.js';
import { createGetRecordingHandler } from './modules/recording/recording.handler.js';
import { RecordingRepository } from './modules/recording/recording.repository.js';
import { RecordingService } from './modules/recording/recording.service.js';
import { createWsServer, type WsServer } from './ws/ws-server.js';

export type CreateServerOptions = {
  env: Env;
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
  return createWsServer({
    port: env.PORT,
    apiKeys: env.API_KEYS,
    handlers: [
      createStatusHandler(bootstrap),
      createGetRecordingHandler(recording),
    ],
    heartbeatIntervalMs: env.HEARTBEAT_INTERVAL_MS,
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    logger,
  });
};
