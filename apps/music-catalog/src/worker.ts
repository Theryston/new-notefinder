import { loadWorkerEnv } from './config/env.js';
import { createMusicCatalogWorker } from './create-server.js';
import { createDatabase, createPool } from './database/database.js';
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
const controller = new AbortController();
const worker = createMusicCatalogWorker({
  env,
  db: createDatabase(pool),
  logger,
  signal: controller.signal,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info('Shutting down', { signal });
    controller.abort();
  });
}

logger.info('Worker started', { dataset: env.CATALOG_DATASET });

await runWorkerLoop({
  tick: worker.tick,
  intervalMs: IDLE_INTERVAL_MS,
  signal: controller.signal,
  logger,
});
await pool.end();

logger.info('Worker stopped');
