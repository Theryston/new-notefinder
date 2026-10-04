import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import {
  LYRICS_INDEX_SETTINGS,
  type LyricsDocument,
} from '../../lib/lyrics-index.js';
import {
  RECORDINGS_INDEX,
  RECORDINGS_INDEX_SETTINGS,
  type RecordingDocument,
} from '../../lib/recordings-index.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { LyricsService } from '../lyrics/lyrics.service.js';
import type { RecordingDocumentService } from '../recording/recording-document.service.js';
import type { IndexingRepository } from './indexing.repository.js';
import { indexingPercent } from './indexing-progress.js';

type IndexingLyricsDeps = {
  /** The kept Lyrics, read in the same id order as the Recordings. */
  documents: LyricsService;
  /** Opened with the key that can write: only the worker indexes. */
  index: MeilisearchIndex<LyricsDocument>;
};

export type IndexingServiceDeps = {
  bootstrap: BootstrapService;
  documents: RecordingDocumentService;
  repository: IndexingRepository;
  /** Opened with the key that can write: only the worker indexes. */
  index: MeilisearchIndex<RecordingDocument>;
  /** How many Recordings go to Meilisearch in one task. */
  batchSize: number;
  logger: Logger;
  /**
   * The Lyrics side of the indexing. Optional so the specs written before
   * Lyrics keep constructing the service without it; the composition root
   * always passes it, and without it no Lyrics document is indexed.
   */
  lyrics?: IndexingLyricsDeps;
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
    const { bootstrap } = this.deps;
    const startedAt = Date.now();
    const { phase } = await bootstrap.getStatus();
    if (phase === 'restored') {
      await bootstrap.startIndexing();
    } else if (phase !== 'indexing') {
      return;
    }
    const total = await this.runDetached(signal);
    if (total !== undefined) {
      await bootstrap.markReady();
      this.deps.logger.info('Indexing finished: the catalog is ready', {
        total,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  /**
   * Indexes every Recording without touching the bootstrap phases: the
   * blue-green reimport walks the parallel copy this way, tracking its own
   * state instead of the first import's. Returns the Recording count, or
   * undefined when aborted before the last batch.
   */
  async runDetached(signal: AbortSignal): Promise<number | undefined> {
    const { index, repository } = this.deps;
    await index.ensure(RECORDINGS_INDEX_SETTINGS);
    await this.deps.lyrics?.index.ensure(LYRICS_INDEX_SETTINGS);
    const checkpoint = await repository.getCheckpoint(RECORDINGS_INDEX.uid);
    const total = await this.deps.documents.countAll();
    if (await this.indexFrom(checkpoint, total, signal)) {
      return total;
    }
    return undefined;
  }

  // Returns whether every Recording was indexed (false: stopped early).
  private async indexFrom(
    checkpoint: number,
    total: number,
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
      await this.indexLyricsBatch(afterId, batchSize);
      await repository.saveCheckpoint(
        RECORDINGS_INDEX.uid,
        batch.lastRecordingId,
      );
      afterId = batch.lastRecordingId;
      indexed += batch.documents.length;
      logger.info('Indexed a batch of Recordings', {
        batch: batchNumber,
        indexed,
        total,
        percent: indexingPercent(indexed, total),
        lastRecordingId: afterId,
      });
    }
    logger.info('Indexing paused: the worker is stopping', { indexed });
    return false;
  }

  // The kept Lyrics of the batch just indexed: replacing documents by MBID
  // is idempotent, so a batch sent but not checkpointed is sent again
  // harmlessly, and Lyrics need no checkpoint of their own. A batch without
  // Lyrics sends nothing, so the index is left alone until there is.
  private async indexLyricsBatch(
    afterId: number,
    limit: number,
  ): Promise<void> {
    const lyrics = this.deps.lyrics;
    if (lyrics === undefined) {
      return;
    }
    const documents = await lyrics.documents.findDocuments(afterId, limit);
    if (documents.length > 0) {
      await lyrics.index.upsert(documents);
    }
  }
}
