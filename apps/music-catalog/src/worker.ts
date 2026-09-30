import { loadEnv } from './config/env.js';
import { createLogger } from './logger.js';
import { runWorkerLoop } from './worker/worker-loop.js';

const IDLE_INTERVAL_MS = 5000;

const env = loadEnv();
const logger = createLogger({
  name: 'worker',
  json: env.NODE_ENV === 'production',
});
const controller = new AbortController();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info('Shutting down', { signal });
    controller.abort();
  });
}

logger.info('Worker started', { dataset: env.CATALOG_DATASET });

await runWorkerLoop({
  // Nothing to do yet: the bootstrap, the Sonic indexing, the outbox
  // draining and the LRCLIB refresh each add their step here.
  tick: async () => undefined,
  intervalMs: IDLE_INTERVAL_MS,
  signal: controller.signal,
  logger,
});

logger.info('Worker stopped');
