import { loadWorkerEnv } from './config/env.js';
import { createMusicCatalogWorker } from './create-server.js';
import { createDatabase, createPool } from './database/database.js';
import { createShutdownSignal } from './lib/shutdown-signal.js';
import { createLogger } from './logger.js';
import { runWorkerLoop } from './worker/worker-loop.js';

const IDLE_INTERVAL_MS = 5000;

const env = loadWorkerEnv();
const logger = createLogger({
  name: 'worker',
  json: env.NODE_ENV === 'production',
});
const pool = createPool(env.DATABASE_URL, (error) => {
  logger.error('Database connection error', { error });
});
// Aborting it stops the loop after the batch in progress.
const signal = createShutdownSignal(logger);
const worker = createMusicCatalogWorker({
  env,
  db: createDatabase(pool),
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

logger.info('Worker stopped');
