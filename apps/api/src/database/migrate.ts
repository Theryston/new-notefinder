import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadEnv } from '../config/env.js';
import { createDatabase, createPool } from './database.js';

/**
 * Applies pending migrations from `apps/api/drizzle`. Runs as an explicit
 * deploy step (`nub run db:migrate` locally, `node dist/database/migrate.js`
 * in the production image), never on app boot, so several API instances can
 * start without racing on the schema. Uses drizzle-orm's migrator instead of
 * drizzle-kit, which is a dev dependency.
 */

// Resolves to apps/api/drizzle from both src/database and dist/database.
const migrationsFolder = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

const logger = new Logger('Migrate');
const pool = createPool(loadEnv().DATABASE_URL);

try {
  await migrate(createDatabase(pool), { migrationsFolder });
  logger.log('Migrations applied');
} finally {
  await pool.end();
}
