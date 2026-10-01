import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { TestProject } from 'vitest/node';
import { createDatabase, createPool } from '../../src/database/database.js';
import { createLogger } from '../../src/logger.js';
import { type E2eMeilisearch, startMeilisearch } from './meilisearch.js';
import { applyMusicBrainzSchema } from './musicbrainz-schema.js';
import { applySyncTriggers } from './sync-triggers.js';

declare module 'vitest' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: augments Vitest's interface, which needs declaration merging.
  export interface ProvidedContext {
    /** Connection URL of the migrated e2e database. */
    databaseUrl: string;
    /** Where the e2e Meilisearch is and the keys the services use. */
    meilisearch: E2eMeilisearch;
  }
}

// Same major version as the dev compose (apps/music-catalog/docker-compose.yml).
const POSTGRES_IMAGE = 'postgres:17-alpine';
// Covers pulling the image on a cold CI runner, not only the boot.
const STARTUP_TIMEOUT_MS = 120_000;

const logger = createLogger({ name: 'e2e-database', json: false });

const migrationsFolder = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

type Database = { url: string; stop: () => Promise<void> };

const startContainer = async (): Promise<Database> => {
  try {
    logger.info(`Starting ${POSTGRES_IMAGE} with Testcontainers`);
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withStartupTimeout(STARTUP_TIMEOUT_MS)
      .start();
    return {
      url: container.getConnectionUri(),
      stop: async () => {
        await container.stop();
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not start the e2e Postgres with Testcontainers (${reason}). ` +
        'Make sure Docker is running, or set E2E_DATABASE_URL to a database ' +
        'dedicated to tests (its music_catalog tables are truncated).',
    );
  }
};

// The real migrations, applied exactly like `db:migrate` does.
const migrateDatabase = async (url: string): Promise<void> => {
  const pool = createPool(url, (error) => {
    logger.warn('Database connection error', { error });
  });
  try {
    await migrate(createDatabase(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
};

/**
 * Starts one Postgres and one Meilisearch for the whole e2e run (or uses
 * `E2E_DATABASE_URL` and `E2E_MEILISEARCH_URL`), applies the migrations and
 * the MusicBrainz schema, and provides both to the test workers.
 */
export const setup = async (
  project: TestProject,
): Promise<() => Promise<void>> => {
  const externalUrl = process.env.E2E_DATABASE_URL;
  const database: Database = externalUrl
    ? { url: externalUrl, stop: async () => undefined }
    : await startContainer();
  try {
    await migrateDatabase(database.url);
    logger.info('Migrations applied');
    // Next to our schema, like the mbslave container puts the MusicBrainz one
    // in production: the tables the service reads.
    await applyMusicBrainzSchema(database.url);
    logger.info('MusicBrainz schema applied');
    // The worker's change triggers, which production installs after the
    // restore: the fixture writes below must reach the outbox the same way.
    await applySyncTriggers(database.url);
    logger.info('Sync triggers applied');
  } catch (error) {
    await database.stop();
    throw error;
  }
  const search = await startMeilisearch().catch(async (error: unknown) => {
    await database.stop();
    throw error;
  });
  project.provide('databaseUrl', database.url);
  project.provide('meilisearch', search.meilisearch);
  return async () => {
    await search.stop();
    await database.stop();
  };
};
