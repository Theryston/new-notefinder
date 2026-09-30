import { inject } from 'vitest';
import { type Env, parseEnv } from '../../src/config/env.js';
import { createMusicCatalogServer } from '../../src/create-server.js';
import type { Database } from '../../src/database/database.js';
import { createDatabase, createPool } from '../../src/database/database.js';
import { createLogger } from '../../src/logger.js';

// The real logger with its output discarded, so the expected errors of the
// failure cases stay out of the test output.
const logger = createLogger({
  name: 'e2e-server',
  json: true,
  out: () => undefined,
  err: () => undefined,
});

/** Two keys are configured, so specs can check that rotation works. */
export const API_KEY = 'e2e-primary-key-'.padEnd(40, '0');
export const ROTATED_API_KEY = 'e2e-rotated-key-'.padEnd(40, '1');

export type TestServer = {
  /** `ws://127.0.0.1:<port>` of the running server. */
  url: string;
  env: Env;
  /** The server's database, for arranging what the import would have written. */
  db: Database;
  close: () => Promise<void>;
};

/**
 * Boots the real server (wired exactly like `server.ts`) on a free port,
 * against the e2e database. `env` overrides the defaults below, as strings,
 * the way the environment provides them.
 */
const createTestServer = async (
  env: Record<string, string> = {},
): Promise<TestServer> => {
  const parsed = parseEnv({
    NODE_ENV: 'test',
    PORT: '0',
    DATABASE_URL: inject('databaseUrl'),
    API_KEYS: `${API_KEY},${ROTATED_API_KEY}`,
    CATALOG_DATASET: 'sample',
    ...env,
  });
  const pool = createPool(parsed.DATABASE_URL, () => undefined);
  const db = createDatabase(pool);
  const server = createMusicCatalogServer({
    env: parsed,
    db,
    logger,
  });
  const { port } = await server.start();
  return {
    url: `ws://127.0.0.1:${port}`,
    env: parsed,
    db,
    close: async () => {
      await server.stop();
      await pool.end();
    },
  };
};

/**
 * Boots a test server for the whole spec file (`beforeAll`), closes it after
 * (`afterAll`) and returns how to reach it. Call it at the top of `describe`.
 */
export const useTestServer = (
  env: Record<string, string> = {},
): (() => TestServer) => {
  let server: TestServer | undefined;

  beforeAll(async () => {
    server = await createTestServer(env);
  });

  afterAll(async () => {
    await server?.close();
  });

  return () => {
    if (server === undefined) {
      throw new Error('The test server is only available inside a test');
    }
    return server;
  };
};
