import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { RecordingDocument } from '../../lib/recordings-index.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type {
  CurrentDocument,
  RecordingDocumentService,
} from '../recording/recording-document.service.js';
import type { TrackAssociationRepository } from '../track-association/track-association.repository.js';
import type { RecordingOutboxRepository } from './recording-outbox.repository.js';
import { type OutboxEntry, planSync } from './sync-plan.js';

export type SyncServiceDeps = {
  bootstrap: BootstrapService;
  outbox: RecordingOutboxRepository;
  documents: RecordingDocumentService;
  /** Opened with the key that can write: only the worker syncs. */
  index: MeilisearchIndex<RecordingDocument>;
  /** How many outbox entries one batch rebuilds. */
  batchSize: number;
  logger: Logger;
  associations?: TrackAssociationRepository;
  /** Serializes complete-document replacement with Track association writes. */
  writeLock?: <Result>(run: () => Promise<Result>) => Promise<Result>;
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
   * The oldest outbox entries still waiting to reach the index. It never
   * marks anything, so the drain below still owns every entry.
   */
  async peekPending(limit: number): Promise<OutboxEntry[]> {
    return this.deps.outbox.peekPending(limit);
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
        break;
      }
      const ids = [...new Set(entries.map((entry) => entry.recordingId))];
      const syncBatch = async (): Promise<void> => {
        const found: CurrentDocument[] =
          await documents.findDocumentsByIds(ids);
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
      };
      await (this.deps.writeLock?.(syncBatch) ?? syncBatch());
      synced += entries.length;
      logger.info('Synced a batch of Recordings', {
        synced,
        recordings: ids.length,
      });
    }
    await this.drainAssociations();
    logger.info('Sync drained the pending MusicBrainz changes', { synced });
  }

  async drainAssociations(): Promise<void> {
    await this.drainPendingAssociations(this.deps.batchSize);
  }

  private async drainPendingAssociations(limit: number): Promise<void> {
    const { associations, documents, index, writeLock } = this.deps;
    if (associations === undefined) return;
    const processBatch = async (): Promise<number> => {
      const mbids = await associations.peekPending(limit);
      if (mbids.length === 0) return 0;
      const ids = await documents.findIdsByMbids(mbids);
      const current = await documents.findDocumentsByIds(ids);
      if (current.length > 0) {
        await index.upsert(current.map((recording) => recording.document));
        await associations.markIndexed(
          current.map((recording) => recording.mbid),
        );
      }
      return current.length;
    };
    while (true) {
      const processed = await (writeLock?.(processBatch) ?? processBatch());
      if (processed === 0 || processed < limit) return;
    }
  }
}
