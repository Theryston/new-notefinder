import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { RecordingDocument } from '../../lib/recordings-index.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type {
  CurrentDocument,
  RecordingDocumentService,
} from '../recording/recording-document.service.js';
import type { RecordingOutboxRepository } from './recording-outbox.repository.js';
import { planSync } from './sync-plan.js';

export type SyncServiceDeps = {
  bootstrap: BootstrapService;
  outbox: RecordingOutboxRepository;
  documents: RecordingDocumentService;
  /** Opened with the key that can write: only the worker syncs. */
  index: MeilisearchIndex<RecordingDocument>;
  /** How many outbox entries one batch rebuilds. */
  batchSize: number;
  logger: Logger;
};

export class SyncService {
  constructor(private readonly deps: SyncServiceDeps) {}

  /**
   * Installs the change triggers once the MusicBrainz tables exist (after
   * the restore, before indexing) and puts back any that went missing. A
   * no-op while the restore has not produced the tables yet, and whenever
   * every trigger is already in place.
   */
  async ensureTriggers(): Promise<void> {
    const { phase } = await this.deps.bootstrap.getStatus();
    if (phase === 'restoring') {
      return;
    }
    await this.deps.outbox.ensureTriggers();
  }

  /**
   * Brings the index up to date with the outbox: each batch rebuilds the
   * documents of the Recordings its entries touch (or deletes the MBIDs
   * whose rows are gone) and only then marks the entries done, so a worker
   * that dies mid-batch reprocesses what is left on its return. Runs only
   * once the catalog is ready; the initial indexing owns everything before.
   * Aborting `signal` stops it after the batch in progress.
   */
  async drain(signal: AbortSignal): Promise<void> {
    const { bootstrap, outbox, documents, index, batchSize, logger } =
      this.deps;
    const { phase } = await bootstrap.getStatus();
    if (phase !== 'ready') {
      return;
    }
    let synced = 0;
    while (!signal.aborted) {
      const entries = await outbox.peekPending(batchSize);
      if (entries.length === 0) {
        return;
      }
      const ids = [...new Set(entries.map((entry) => entry.recordingId))];
      const found: CurrentDocument[] = await documents.findDocumentsByIds(ids);
      const current = new Map(
        found.map((recording) => [
          recording.id,
          { mbid: recording.mbid, document: recording.document },
        ]),
      );
      const plan = planSync(entries, current);
      await index.upsert(plan.upserts);
      await index.deleteDocuments(plan.deletes);
      await outbox.markProcessed(entries);
      synced += entries.length;
      logger.info('Synced a batch of Recordings', {
        synced,
        recordings: ids.length,
      });
    }
    logger.info('Sync paused: the worker is stopping', { synced });
  }
}
