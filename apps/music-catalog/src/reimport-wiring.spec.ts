import type { WorkerEnv } from './config/env.js';
import type { Database } from './database/database.js';
import type { MeilisearchIndex } from './integrations/meilisearch/meilisearch-index.js';
import type { LyricsDocument } from './lib/lyrics-index.js';
import type { RecordingDocument } from './lib/recordings-index.js';
import type { Logger } from './logger.js';
import type { BootstrapService } from './modules/bootstrap/bootstrap.service.js';
import type { ReimportStateRepository } from './modules/reimport/reimport-state.repository.js';
import { assembleWorkerReimport } from './reimport-wiring.js';

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

// Assembly shape only: the wiring news up the copy's collaborators, and the
// reimport e2e suite covers what they do against real databases. Every
// collaborator is a stub because only the assembly runs here.
describe('assembleWorkerReimport', () => {
  it('builds a disabled reimport without a parallel database', () => {
    const service = assembleWorkerReimport({
      bootstrap: {} as BootstrapService,
      state: {} as ReimportStateRepository,
      dataset: 'full',
      logger: silentLogger,
      dbSource: () => ({}) as Database,
      index: {} as MeilisearchIndex<RecordingDocument>,
      lyricsIndex: {} as MeilisearchIndex<LyricsDocument>,
      env: {} as WorkerEnv,
    });

    expect(typeof service.maybeRun).toBe('function');
  });

  it('builds the four steps of the parallel copy', () => {
    const service = assembleWorkerReimport({
      bootstrap: {} as BootstrapService,
      state: {
        get: async () => ({
          phase: 'indexing' as const,
          progressPct: null,
          detail: null,
        }),
      } as ReimportStateRepository,
      dataset: 'full',
      logger: silentLogger,
      dbSource: () => ({}) as Database,
      index: {} as MeilisearchIndex<RecordingDocument>,
      lyricsIndex: {} as MeilisearchIndex<LyricsDocument>,
      env: {
        MEILISEARCH_URL: 'http://meilisearch:7700',
        MEILISEARCH_WRITE_API_KEY: 'write-key',
        INDEXING_BATCH_SIZE: 10,
        CATALOG_DATASET: 'full',
        DATABASE_URL: 'postgres://host/serving',
      } as WorkerEnv,
      nextCopy: { db: {} as Database, url: 'postgres://host/next' },
    });

    expect(typeof service.maybeRun).toBe('function');
  });
});
