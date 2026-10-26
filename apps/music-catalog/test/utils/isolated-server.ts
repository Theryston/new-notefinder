import type { BootstrapPhase } from '@notefinder/contracts';
import { inject } from 'vitest';
import { parseServerEnv, type ServerEnv } from '../../src/config/env.js';
import { createMusicCatalogServer } from '../../src/create-server.js';
import { createDatabase, createPool } from '../../src/database/database.js';
import type { SearchReadiness } from '../../src/modules/search/search-readiness.js';
import {
  API_KEY,
  type TestServer,
  testLogger,
  waitForSearchPhase,
} from './create-test-server.js';
import { resetDatabase } from './database.js';
import { connect, type TestClient } from './ws-client.js';

export type IsolatedServer = {
  server: () => TestServer;
  client: () => TestClient;
};

type RunningServer = {
  url: string;
  env: ServerEnv;
  stop: () => Promise<void>;
  db: ReturnType<typeof createDatabase>;
  waitForSearchPhase: (phase: BootstrapPhase) => Promise<void>;
};

// Boots the real server on a free port against the e2e database, resetting
// it first: the next test starts from an empty catalog either way.
const bootIsolatedServer = async (): Promise<RunningServer> => {
  const meilisearch = inject('meilisearch');
  const parsed = parseServerEnv({
    NODE_ENV: 'test',
    PORT: '0',
    DATABASE_URL: inject('databaseUrl'),
    API_KEYS: API_KEY,
    CATALOG_DATASET: 'tiny',
    MEILISEARCH_URL: meilisearch.url,
    MEILISEARCH_SEARCH_API_KEY: meilisearch.searchKey,
  });
  const pool = createPool(parsed.DATABASE_URL, () => undefined);
  const db = createDatabase(pool);
  await resetDatabase(db);
  let readiness: SearchReadiness | undefined;
  const ws = createMusicCatalogServer({
    env: parsed,
    db,
    logger: testLogger,
    searchReadinessRefreshIntervalMs: 10,
    onSearchReadinessCreated: (cache) => {
      readiness = cache;
    },
  });
  const { port } = await ws.start();
  if (readiness === undefined) {
    throw new Error('The test server did not expose search readiness');
  }
  const searchCache = readiness;
  return {
    url: `ws://127.0.0.1:${port}`,
    env: parsed,
    db,
    waitForSearchPhase: (phase) => waitForSearchPhase(searchCache, phase),
    stop: async () => {
      await ws.stop();
      await pool.end();
    },
  };
};

/**
 * Boots a fresh server per test (not per file): a test that flips its
 * process to the parallel database must not leak that adoption into the
 * next test, so each test reads the serving copy again. Mirrors
 * `useTestServer`/`useTestClient`, with the database reset per test.
 */
export const useIsolatedServer = (): IsolatedServer => {
  let running: RunningServer | undefined;
  let tcpClient: TestClient | undefined;

  beforeEach(async () => {
    running = await bootIsolatedServer();
    tcpClient = await connect(running.url, API_KEY);
  });

  afterEach(async () => {
    await tcpClient?.close();
    tcpClient = undefined;
    await running?.stop();
    running = undefined;
  });

  return {
    server: (): TestServer => {
      if (running === undefined) {
        throw new Error('The test server is only available inside a test');
      }
      return {
        url: running.url,
        env: running.env,
        db: running.db,
        waitForSearchPhase: running.waitForSearchPhase,
        close: running.stop,
      };
    },
    client: () => {
      if (tcpClient === undefined) {
        throw new Error('The test client is only available inside a test');
      }
      return tcpClient;
    },
  };
};
