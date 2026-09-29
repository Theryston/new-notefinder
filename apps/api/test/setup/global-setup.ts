import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { TestProject } from 'vitest/node';
import { type StartedStorage, startStorage } from './minio.js';
import type { E2eStorage } from './storage-settings.js';

declare module 'vitest' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: augments Vitest's interface, which needs declaration merging.
  export interface ProvidedContext {
    /** Connection URL of the migrated e2e database. */
    databaseUrl: string;
    /** The S3-compatible server (MinIO) with the e2e bucket. */
    storage: E2eStorage;
  }
}

// Same major version as production (docker-compose.yml).
const POSTGRES_IMAGE = 'postgres:17-alpine';
// Covers pulling the image on a cold CI runner, not only the boot.
const CONTAINER_STARTUP_TIMEOUT_MS = 120_000;

const logger = new Logger('E2eDatabase');

const migrationsFolder = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

const startContainer = async (): Promise<StartedPostgreSqlContainer> => {
  try {
    logger.log(`Starting ${POSTGRES_IMAGE} with Testcontainers`);
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withStartupTimeout(CONTAINER_STARTUP_TIMEOUT_MS)
      .start();
    logger.log(
      `Postgres container ${container.getId().slice(0, 12)} listening on ` +
        `${container.getHost()}:${container.getPort()}`,
    );
    return container;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not start the e2e Postgres container with Testcontainers (${reason}). ` +
        'Make sure Docker is running, or set E2E_DATABASE_URL to an existing ' +
        'database dedicated to tests (every table in it is truncated).',
    );
  }
};

// Uses drizzle-orm's migrator on the committed SQL in drizzle/, exactly like
// `db:migrate` and the production image do.
const migrateDatabase = async (url: string): Promise<void> => {
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }
};

/**
 * Starts one Postgres for the whole e2e run (or uses `E2E_DATABASE_URL`),
 * applies the real migrations, starts one MinIO (see `minio.ts`) and hands
 * both to the test workers, where `database-env.ts` exposes them as
 * `DATABASE_URL` and the `S3_*` variables.
 */
export const setup = async (
  project: TestProject,
): Promise<() => Promise<void>> => {
  const externalUrl = process.env.E2E_DATABASE_URL;
  if (externalUrl) {
    logger.log('Using E2E_DATABASE_URL instead of a container');
  }
  const container = externalUrl ? undefined : await startContainer();
  const databaseUrl = externalUrl ?? container?.getConnectionUri();
  if (databaseUrl === undefined) {
    throw new Error('No e2e database URL');
  }

  let storage: StartedStorage;
  try {
    await migrateDatabase(databaseUrl);
    logger.log('Migrations applied');
    storage = await startStorage();
  } catch (error) {
    await container?.stop();
    throw error;
  }
  project.provide('databaseUrl', databaseUrl);
  project.provide('storage', storage.storage);

  return async () => {
    await storage.stop();
    if (container) {
      await container.stop();
      logger.log('Postgres container stopped');
    }
  };
};
