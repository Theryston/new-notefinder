import { loadWorkerEnv } from './config/env.js';
import { createMusicCatalogWorker } from './create-server.js';
import { createDatabase, createPool } from './database/database.js';
import { createShutdownSignal } from './lib/shutdown-signal.js';
import { createLogger } from './logger.js';
import { readReimportStateOf } from './modules/reimport/read-reimport-state.js';
import { resolveServingDatabaseUrl } from './modules/reimport/resolve-serving-url.js';
import { runWorkerLoop } from './worker/worker-loop.js';

const IDLE_INTERVAL_MS = 5000;

const env = loadWorkerEnv();
const logger = createLogger({
  name: 'worker',
  json: env.NODE_ENV === 'production',
});
// Like the server: open the database the flip record points at, when a
// reimport already flipped the serving copy.
const servingUrl = await resolveServingDatabaseUrl({
  configuredUrl: env.DATABASE_URL,
  reimportUrl: env.REIMPORT_DATABASE_URL,
  readReimportState: (url) =>
    readReimportStateOf(url, (error) => {
      logger.error('Database connection error', { error });
    }),
});
const pool = createPool(servingUrl, (error) => {
  logger.error('Database connection error', { error });
});
const reimportUrl = env.REIMPORT_DATABASE_URL;
const nextPool =
  reimportUrl === undefined
    ? undefined
    : createPool(reimportUrl, (error) => {
        logger.error('Database connection error', { error });
      });
// Aborting it stops the loop after the batch in progress.
const signal = createShutdownSignal(logger);
const worker = createMusicCatalogWorker({
  env,
  db: createDatabase(pool),
  nextCopy:
    nextPool === undefined || reimportUrl === undefined
      ? undefined
      : { db: createDatabase(nextPool), url: reimportUrl },
  logger,
  signal,
});

logger.info('Worker started', { dataset: env.CATALOG_DATASET });

await runWorkerLoop({
  tick: worker.tick,
  intervalMs: IDLE_INTERVAL_MS,
  signal,
  logger,
});
await pool.end();
await nextPool?.end();

logger.info('Worker stopped');
