import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import {
  RECORDINGS_INDEX,
  RECORDINGS_INDEX_SETTINGS,
  type RecordingDocument,
} from '../../lib/recordings-index.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { RecordingDocumentService } from '../recording/recording-document.service.js';
import type { IndexingRepository } from './indexing.repository.js';

export type IndexingServiceDeps = {
  bootstrap: BootstrapService;
  documents: RecordingDocumentService;
  repository: IndexingRepository;
  /** Opened with the key that can write: only the worker indexes. */
  index: MeilisearchIndex<RecordingDocument>;
  /** How many Recordings go to Meilisearch in one task. */
  batchSize: number;
  logger: Logger;
};

export class IndexingService {
  constructor(private readonly deps: IndexingServiceDeps) {}

  /**
   * One round of the worker's initial indexing. It waits (does nothing)
   * until the mbslave container has restored the MusicBrainz data, then
   * sends every Recording to Meilisearch in batches: each batch is waited
   * for, and only then is the checkpoint moved past it, so a worker that
   * dies mid-indexing resumes after the last batch Meilisearch confirmed
   * (a batch that was sent but not checkpointed is sent again, which is
   * harmless: documents are replaced by MBID). When the last batch is in,
   * the catalog becomes `ready`. Aborting `signal` stops it after the batch
   * in progress; the next round continues.
   */
  async run(signal: AbortSignal): Promise<void> {
    const { bootstrap, index, repository } = this.deps;
    const { phase } = await bootstrap.getStatus();
    if (phase === 'restored') {
      await bootstrap.startIndexing();
    } else if (phase !== 'indexing') {
      return;
    }
    await index.ensure(RECORDINGS_INDEX_SETTINGS);
    const checkpoint = await repository.getCheckpoint(RECORDINGS_INDEX.uid);
    if (await this.indexFrom(checkpoint, signal)) {
      await bootstrap.markReady();
      this.deps.logger.info('Indexing finished: the catalog is ready');
    }
  }

  // Returns whether every Recording was indexed (false: stopped early).
  private async indexFrom(
    checkpoint: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    const { documents, index, repository, batchSize, logger } = this.deps;
    let afterId = checkpoint;
    let indexed = 0;
    for (let batchNumber = 1; !signal.aborted; batchNumber++) {
      const batch = await documents.findBatch(afterId, batchSize);
      if (batch === undefined) {
        return true;
      }
      await index.upsert(batch.documents);
      await repository.saveCheckpoint(
        RECORDINGS_INDEX.uid,
        batch.lastRecordingId,
      );
      afterId = batch.lastRecordingId;
      indexed += batch.documents.length;
      logger.info('Indexed a batch of Recordings', {
        batch: batchNumber,
        indexed,
        lastRecordingId: afterId,
      });
    }
    logger.info('Indexing paused: the worker is stopping', { indexed });
    return false;
  }
}
