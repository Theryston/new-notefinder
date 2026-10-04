import type { DatabaseSource } from '../database/database-ref.js';
import type { MeilisearchIndex } from '../integrations/meilisearch/meilisearch-index.js';
import { createMeilisearchIndex } from '../integrations/meilisearch/meilisearch-index.js';
import { LYRICS_INDEX, type LyricsDocument } from '../lib/lyrics-index.js';
import {
  RECORDINGS_INDEX,
  type RecordingDocument,
} from '../lib/recordings-index.js';
import type { Logger } from '../logger.js';
import type { BootstrapService } from '../modules/bootstrap/bootstrap.service.js';
import { IndexingRepository } from '../modules/indexing/indexing.repository.js';
import { IndexingService } from '../modules/indexing/indexing.service.js';
import { LyricsRepository } from '../modules/lyrics/lyrics.repository.js';
import { LyricsService } from '../modules/lyrics/lyrics.service.js';
import { RecordingDocumentRepository } from '../modules/recording/recording-document.repository.js';
import { RecordingDocumentService } from '../modules/recording/recording-document.service.js';
import { RecordingOutboxRepository } from '../modules/sync/recording-outbox.repository.js';
import { SyncService } from '../modules/sync/sync.service.js';

export type ServingIndexingOptions = {
  bootstrap: BootstrapService;
  dbSource: DatabaseSource;
  meilisearchUrl: string;
  writeApiKey: string;
  batchSize: number;
  logger: Logger;
};

export type ServingIndexing = {
  documents: RecordingDocumentService;
  /** The worker is the only writer of the indexes: built with its key. */
  index: MeilisearchIndex<RecordingDocument>;
  lyricsIndex: MeilisearchIndex<LyricsDocument>;
  indexing: IndexingService;
  sync: SyncService;
};

/**
 * The serving copy's write path: the initial indexing with its documents
 * and search indexes, and the continuous sync drain on top of them. Lives
 * beside the worker root (not a feature module): it only news up the path,
 * and the indexing and sync suites cover what it builds.
 */
export const buildServingIndexing = (
  options: ServingIndexingOptions,
): ServingIndexing => {
  const { bootstrap, dbSource, logger } = options;
  const documents = new RecordingDocumentService(
    new RecordingDocumentRepository(dbSource),
  );
  const index = createMeilisearchIndex<RecordingDocument>({
    url: options.meilisearchUrl,
    apiKey: options.writeApiKey,
    ...RECORDINGS_INDEX,
  });
  const lyricsIndex = createMeilisearchIndex<LyricsDocument>({
    url: options.meilisearchUrl,
    apiKey: options.writeApiKey,
    ...LYRICS_INDEX,
  });
  return {
    documents,
    index,
    lyricsIndex,
    indexing: new IndexingService({
      bootstrap,
      documents,
      repository: new IndexingRepository(dbSource),
      index,
      lyrics: {
        documents: new LyricsService(new LyricsRepository(dbSource)),
        index: lyricsIndex,
      },
      batchSize: options.batchSize,
      logger,
    }),
    sync: new SyncService({
      bootstrap,
      outbox: new RecordingOutboxRepository(dbSource),
      documents,
      index,
      batchSize: options.batchSize,
      logger,
    }),
  };
};
