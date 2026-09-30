import { GenericContainer, Wait } from 'testcontainers';
import { createLogger } from '../../src/logger.js';
import { meilisearchRequest } from '../utils/meilisearch-http.js';

// Same release as the dev compose (apps/music-catalog/docker-compose.yml) and
// the benchmark that chose the engine. Docker Hub's image, pinned to a stable
// v1.x: bump both together.
const MEILISEARCH_IMAGE = 'getmeili/meilisearch:v1.54.2';
const MEILISEARCH_PORT = 7700;
// Covers pulling the image on a cold CI runner, not only the boot.
const STARTUP_TIMEOUT_MS = 120_000;
const MASTER_KEY = 'e2e-meilisearch-master-key-0123456789';

// Fixed uids, so the keys are the same on every run (a key is derived from
// its uid and the master key) and a reused server gets them replaced.
const SEARCH_KEY_UID = '5ea2c4a1-0000-4000-8000-0000000000e1';
const WRITE_KEY_UID = '5ea2c4a1-0000-4000-8000-0000000000e2';

const logger = createLogger({ name: 'e2e-meilisearch', json: false });

/**
 * How the e2e run reaches Meilisearch. The server only gets the search key
 * and the worker the write key, exactly as in production, so a missing
 * permission fails a spec instead of hiding behind the master key.
 */
export type E2eMeilisearch = {
  url: string;
  /** Creates keys and empties indexes between tests; no service gets it. */
  masterKey: string;
  searchKey: string;
  writeKey: string;
};

type Started = { url: string; masterKey: string; stop: () => Promise<void> };

const startContainer = async (): Promise<Started> => {
  try {
    logger.info(`Starting ${MEILISEARCH_IMAGE} with Testcontainers`);
    const container = await new GenericContainer(MEILISEARCH_IMAGE)
      .withExposedPorts(MEILISEARCH_PORT)
      .withEnvironment({
        MEILI_MASTER_KEY: MASTER_KEY,
        MEILI_NO_ANALYTICS: 'true',
      })
      .withWaitStrategy(Wait.forHttp('/health', MEILISEARCH_PORT))
      .withStartupTimeout(STARTUP_TIMEOUT_MS)
      .start();
    return {
      url: `http://${container.getHost()}:${container.getMappedPort(MEILISEARCH_PORT)}`,
      masterKey: MASTER_KEY,
      stop: async () => {
        await container.stop();
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not start the e2e Meilisearch with Testcontainers (${reason}). ` +
        'Make sure Docker is running, or set E2E_MEILISEARCH_URL and ' +
        'E2E_MEILISEARCH_MASTER_KEY to a Meilisearch dedicated to tests (its ' +
        'recordings index is deleted between tests).',
    );
  }
};

const externalServer = (): Started | undefined => {
  const url = process.env.E2E_MEILISEARCH_URL;
  if (!url) {
    return undefined;
  }
  const masterKey = process.env.E2E_MEILISEARCH_MASTER_KEY;
  if (!masterKey) {
    throw new Error(
      'E2E_MEILISEARCH_URL also needs E2E_MEILISEARCH_MASTER_KEY',
    );
  }
  return {
    url: url.replace(/\/+$/, ''),
    masterKey,
    stop: async () => undefined,
  };
};

// Mirrors the keys the dev compose creates (`meilisearch-init`): the server
// can only search, the worker can manage indexes, settings and documents.
const createKey = async (
  server: Started,
  key: { uid: string; name: string; actions: string[]; indexes: string[] },
): Promise<string> => {
  // A reused server may still have the key from an earlier run.
  await meilisearchRequest(server, 'DELETE', `/keys/${key.uid}`);
  const created = await meilisearchRequest(server, 'POST', '/keys', {
    ...key,
    expiresAt: null,
  });
  if (created.status !== 201 || typeof created.json.key !== 'string') {
    throw new Error(
      `Could not create the ${key.name} key (HTTP ${created.status})`,
    );
  }
  return created.json.key;
};

/**
 * Starts one Meilisearch for the whole e2e run (or uses
 * `E2E_MEILISEARCH_URL`) and creates the two scoped keys the service uses.
 */
export const startMeilisearch = async (): Promise<{
  meilisearch: E2eMeilisearch;
  stop: () => Promise<void>;
}> => {
  const server = externalServer() ?? (await startContainer());
  try {
    const searchKey = await createKey(server, {
      uid: SEARCH_KEY_UID,
      name: 'music-catalog-search',
      actions: ['search'],
      indexes: ['recordings', 'lyrics'],
    });
    const writeKey = await createKey(server, {
      uid: WRITE_KEY_UID,
      name: 'music-catalog-write',
      actions: ['documents.*', 'indexes.*', 'settings.*', 'tasks.get'],
      indexes: ['*'],
    });
    return {
      meilisearch: {
        url: server.url,
        masterKey: server.masterKey,
        searchKey,
        writeKey,
      },
      stop: server.stop,
    };
  } catch (error) {
    await server.stop();
    throw error;
  }
};
