import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadEnv } from '../config/env.js';
import { createLogger } from '../logger.js';
import { createDatabase, createPool } from './database.js';

/**
 * Applies pending migrations from `apps/music-catalog/drizzle`. Runs as an
 * explicit deploy step (`nub run db:migrate` locally), never on server boot,
 * so a server and a worker can start together without racing on the schema.
 * Uses drizzle-orm's migrator instead of drizzle-kit, which is a dev
 * dependency.
 */

// Resolves to apps/music-catalog/drizzle from both src/database and
// dist/database.
const migrationsFolder = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

const env = loadEnv();
const logger = createLogger({
  name: 'migrate',
  json: env.NODE_ENV === 'production',
});
const pool = createPool(env.DATABASE_URL, (error) => {
  logger.error('Database connection error', { error });
});

try {
  await migrate(createDatabase(pool), { migrationsFolder });
  logger.info('Migrations applied');
} finally {
  await pool.end();
}
