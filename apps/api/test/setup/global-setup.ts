import { fileURLToPath } from 'node:url';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Connection URL of the migrated e2e database. */
    databaseUrl: string;
  }
}

// Same major version as production (docker-compose.yml).
const POSTGRES_IMAGE = 'postgres:17-alpine';
// Covers pulling the image on a cold CI runner, not only the boot.
const CONTAINER_STARTUP_TIMEOUT_MS = 120_000;

const migrationsFolder = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

const startContainer = async (): Promise<StartedPostgreSqlContainer> => {
  try {
    return await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withStartupTimeout(CONTAINER_STARTUP_TIMEOUT_MS)
      .start();
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
 * applies the real migrations and hands the URL to the test workers, where
 * `database-env.ts` exposes it as `DATABASE_URL`.
 */
export const setup = async (
  project: TestProject,
): Promise<() => Promise<void>> => {
  const externalUrl = process.env.E2E_DATABASE_URL;
  const container = externalUrl ? undefined : await startContainer();
  const databaseUrl = externalUrl ?? container?.getConnectionUri();
  if (databaseUrl === undefined) {
    throw new Error('No e2e database URL');
  }

  try {
    await migrateDatabase(databaseUrl);
  } catch (error) {
    await container?.stop();
    throw error;
  }
  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await container?.stop();
  };
};
