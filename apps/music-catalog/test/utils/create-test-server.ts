import type { BootstrapPhase } from '@notefinder/contracts';
import { inject } from 'vitest';
import { parseServerEnv, type ServerEnv } from '../../src/config/env.js';
import { createMusicCatalogServer } from '../../src/create-server.js';
import type { Database } from '../../src/database/database.js';
import { createDatabase, createPool } from '../../src/database/database.js';
import { createLogger } from '../../src/logger.js';
import type { SearchReadiness } from '../../src/modules/search/search-readiness.js';
import { resetDatabase } from './database.js';

// The real logger with its output discarded, so the expected errors of the
// failure cases stay out of the test output.
export const testLogger = createLogger({
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
  env: ServerEnv;
  /** The server's database, for arranging what the import would have written. */
  db: Database;
  /** Waits until the background cache observes the requested test phase. */
  waitForSearchPhase: (phase: BootstrapPhase) => Promise<void>;
  /** Starts a fresh process cache after the test resets the shared database. */
  restart?: () => Promise<void>;
  close: () => Promise<void>;
};

export const waitForSearchPhase = async (
  readiness: SearchReadiness,
  phase: BootstrapPhase,
): Promise<void> => {
  const deadline = Date.now() + 6000;
  while (readiness.currentPhase !== phase) {
    if (Date.now() >= deadline) {
      throw new Error(`Search readiness did not reach ${phase}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

/**
 * Boots the real server (wired exactly like `server.ts`) on a free port,
 * against the e2e database. `env` overrides the defaults below, as strings,
 * the way the environment provides them.
 */
const createTestServer = async (
  env: Record<string, string> = {},
): Promise<TestServer> => {
  const meilisearch = inject('meilisearch');
  const parsed = parseServerEnv({
    NODE_ENV: 'test',
    PORT: '0',
    DATABASE_URL: inject('databaseUrl'),
    API_KEYS: `${API_KEY},${ROTATED_API_KEY}`,
    CATALOG_DATASET: 'tiny',
    MEILISEARCH_URL: meilisearch.url,
    MEILISEARCH_SEARCH_API_KEY: meilisearch.searchKey,
    ...env,
  });
  const pool = createPool(parsed.DATABASE_URL, () => undefined);
  const db = createDatabase(pool);
  // Startup now reads persisted search readiness and cutover state before
  // listening; give each server a known empty catalog just like each test.
  await resetDatabase(db);
  let server: ReturnType<typeof createMusicCatalogServer> | undefined;
  let readiness: SearchReadiness | undefined;
  let url: string | undefined;
  const start = async () => {
    server = createMusicCatalogServer({
      env: parsed,
      db,
      logger: testLogger,
      searchReadinessRefreshIntervalMs: 10,
      onSearchReadinessCreated: (cache) => {
        readiness = cache;
      },
    });
    const { port } = await server.start();
    url = `ws://127.0.0.1:${port}`;
  };
  await start();
  return {
    get url() {
      if (url === undefined) {
        throw new Error('The test server has not started');
      }
      return url;
    },
    env: parsed,
    db,
    waitForSearchPhase: (phase) => {
      if (readiness === undefined) {
        throw new Error('The test server did not expose search readiness');
      }
      return waitForSearchPhase(readiness, phase);
    },
    restart: async () => {
      await server?.stop();
      await start();
    },
    close: async () => {
      await server?.stop();
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
