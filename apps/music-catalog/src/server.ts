import { loadServerEnv } from './config/env.js';
import { createMusicCatalogServer } from './create-server.js';
import { createDatabase, createPool } from './database/database.js';
import { createLogger } from './logger.js';
import { readReimportStateOf } from './modules/reimport/read-reimport-state.js';
import { resolveServingDatabaseUrl } from './modules/reimport/resolve-serving-url.js';

const env = loadServerEnv();
const logger = createLogger({
  name: 'server',
  json: env.NODE_ENV === 'production',
});
// A reimport may have flipped the serving copy since this process was last
// deployed (or dropped the retired copy it flipped from): open the database
// the flip record points at.
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
