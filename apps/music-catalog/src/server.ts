import { loadEnv } from './config/env.js';
import { createMusicCatalogServer } from './create-server.js';
import { createDatabase, createPool } from './database/database.js';
import { createLogger } from './logger.js';

const env = loadEnv();
const logger = createLogger({
  name: 'server',
  json: env.NODE_ENV === 'production',
});
const pool = createPool(env.DATABASE_URL, (error) => {
  logger.error('Database connection error', { error });
});
const server = createMusicCatalogServer({
  env,
  db: createDatabase(pool),
  logger,
});

const { port } = await server.start();
logger.info('Server listening', { port, dataset: env.CATALOG_DATASET });

// Closing every connection with 1001 lets clients reconnect to the next
// instance; once the pool is closed nothing keeps the process alive.
const shutdown = async (signal: string): Promise<void> => {
  logger.info('Shutting down', { signal });
  await server.stop();
  await pool.end();
};

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      logger.error('Shutdown failed', { error });
      process.exitCode = 1;
    });
  });
}
