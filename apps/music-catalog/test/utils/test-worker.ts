import { inject } from 'vitest';
import { parseWorkerEnv } from '../../src/config/env.js';
import { createMusicCatalogWorker } from '../../src/create-server.js';
import type { Database } from '../../src/database/database.js';
import { LYRICS_INDEX } from '../../src/lib/lyrics-index.js';
import { RECORDINGS_INDEX } from '../../src/lib/recordings-index.js';
import { type TestServer, testLogger } from './create-test-server.js';
import { setBootstrapState } from './database.js';
import { meilisearchRequest } from './meilisearch-http.js';

export type TestWorker = ReturnType<typeof createMusicCatalogWorker>;

export type TestWorkerOptions = {
  /** Overrides of the worker's environment, as strings. */
  env?: Record<string, string>;
  /** Aborting it stops the worker once its current batch is indexed. */
  signal?: AbortSignal;
  /** The parallel database a reimport rebuilds, with its URL. */
  nextCopy?: { db: Database; url: string };
};

/**
 * A worker wired exactly like `worker.ts` (same database as the server), with
 * the write key of the e2e Meilisearch. Ticking it is what the real loop does
 * every few seconds; build a new one to simulate a restart.
 */
export const createTestWorker = (
  server: TestServer,
  options: TestWorkerOptions = {},
): TestWorker => {
  const meilisearch = inject('meilisearch');
  return createMusicCatalogWorker({
    env: parseWorkerEnv({
      NODE_ENV: 'test',
      DATABASE_URL: inject('databaseUrl'),
      API_KEYS: server.env.API_KEYS.join(','),
      CATALOG_DATASET: 'tiny',
      MEILISEARCH_URL: meilisearch.url,
      MEILISEARCH_WRITE_API_KEY: meilisearch.writeKey,
      ...options.env,
    }),
    db: server.db,
    nextCopy: options.nextCopy,
    logger: testLogger,
    signal: options.signal ?? new AbortController().signal,
  });
};

/**
 * Takes the catalog from where the mbslave container leaves it (`restored`)
 * to where the worker does (`ready`), indexing every Recording in the
 * MusicBrainz tables. A tick runs the whole indexing.
 */
export const indexCatalog = async (
  server: TestServer,
  worker: TestWorker = createTestWorker(server),
): Promise<void> => {
  await setBootstrapState(server.db, { phase: 'restored', dataset: 'tiny' });
  await worker.tick();
};

const master = (method: string, path: string, body?: unknown) =>
  meilisearchRequest(inject('meilisearch'), method, path, body);

const waitForTask = async (taskUid: unknown): Promise<void> => {
  for (let attempt = 0; attempt < 600; attempt++) {
    const { json } = await master('GET', `/tasks/${taskUid}`);
    if (json.status !== 'enqueued' && json.status !== 'processing') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Meilisearch task ${taskUid} did not finish`);
};

/** What Meilisearch itself answers for `query`: the MBIDs, best first. */
export const meilisearchOrder = async (
  query: string,
  limit = 100,
): Promise<string[]> => {
  const { json } = await master(
    'POST',
    `/indexes/${RECORDINGS_INDEX.uid}/search`,
    { q: query, limit, attributesToRetrieve: [RECORDINGS_INDEX.primaryKey] },
  );
  const hits = json.hits as { mbid: string }[];
  return hits.map((hit) => hit.mbid);
};

/** The settings Meilisearch holds for the recordings index. */
export const meilisearchSettings = async (): Promise<
  Record<string, unknown>
> => {
  const { json } = await master(
    'GET',
    `/indexes/${RECORDINGS_INDEX.uid}/settings`,
  );
  return json;
};

/**
 * Before each test, removes the recordings index, so a test starts from a
 * catalog nothing has indexed. Call it after `useTestClient`.
 */
export const useEmptySearchIndex = (): void => {
  beforeEach(async () => {
    const { status, json } = await master(
      'DELETE',
      `/indexes/${RECORDINGS_INDEX.uid}`,
    );
    if (status === 202) {
      await waitForTask(json.taskUid);
    }
  });
};

/**
 * Before each test, removes the lyrics index, so a test starts with no
 * Lyrics indexed. Call it next to `useEmptySearchIndex`.
 */
export const useEmptyLyricsIndex = (): void => {
  beforeEach(async () => {
    const { status, json } = await master(
      'DELETE',
      `/indexes/${LYRICS_INDEX.uid}`,
    );
    if (status === 202) {
      await waitForTask(json.taskUid);
    }
  });
};
