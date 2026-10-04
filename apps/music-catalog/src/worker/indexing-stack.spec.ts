import type { Database } from '../database/database.js';
import type { Logger } from '../logger.js';
import type { BootstrapService } from '../modules/bootstrap/bootstrap.service.js';
import { buildServingIndexing } from './indexing-stack.js';

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

// Assembly shape only: the stack news up the serving copy's write path,
// and the indexing and sync suites cover what it builds. Every collaborator
// is a stub because only the assembly runs here.
describe('buildServingIndexing', () => {
  it('builds the documents, both indexes, the indexing and the sync', () => {
    const stack = buildServingIndexing({
      bootstrap: {} as BootstrapService,
      dbSource: () => ({}) as Database,
      meilisearchUrl: 'http://meilisearch:7700',
      writeApiKey: 'write-key',
      batchSize: 10,
      logger: silentLogger,
    });

    expect(typeof stack.documents.findBatch).toBe('function');
    expect(typeof stack.index.upsert).toBe('function');
    expect(typeof stack.lyricsIndex.upsert).toBe('function');
    expect(typeof stack.indexing.run).toBe('function');
    expect(typeof stack.sync.drain).toBe('function');
  });
});
