import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { RecordingDocument } from '../../lib/recordings-index.js';
import type {
  DocumentBatch,
  RecordingDocumentService,
} from '../recording/recording-document.service.js';

type WindowOptions = {
  afterId: number;
  batchSize: number;
  signal: AbortSignal;
  documents: Pick<RecordingDocumentService, 'findBatch'>;
  index: Pick<MeilisearchIndex<RecordingDocument>, 'upsert'>;
  confirm: (batch: DocumentBatch) => Promise<void>;
};

type Result = { ok: true } | { ok: false };
type PendingBatch = { batch: DocumentBatch; finished: Promise<Result> };

// Bound memory, queued tasks and the time association writes wait on the fence.
const MAX_PENDING_BATCHES = 3;

class IndexingWindow {
  private readonly pending: PendingBatch[] = [];
  private failure: { error: unknown } | undefined;
  private afterId: number;
  private exhausted = false;

  constructor(private readonly options: WindowOptions) {
    this.afterId = options.afterId;
  }

  async run(): Promise<{ afterId: number; exhausted: boolean }> {
    try {
      await this.fill();
    } catch (error) {
      this.failure ??= { error };
    }
    // Drain even after a read/write failure: no writes may outlive the fence.
    await this.confirmAll();
    if (this.failure !== undefined) throw this.failure.error;
    return { afterId: this.afterId, exhausted: this.exhausted };
  }

  private async fill(): Promise<void> {
    const { documents, index, batchSize, signal } = this.options;
    while (
      this.pending.length < MAX_PENDING_BATCHES &&
      !signal.aborted &&
      this.failure === undefined
    ) {
      const batch = await documents.findBatch(this.afterId, batchSize);
      if (batch === undefined) {
        this.exhausted = true;
        return;
      }
      if (signal.aborted || this.failure !== undefined) return;
      this.afterId = batch.lastRecordingId;
      // Observe rejection immediately, even while the next batch is loading.
      const finished = index.upsert(batch.documents).then(
        (): Result => ({ ok: true }),
        (error: unknown): Result => {
          this.failure ??= { error };
          return { ok: false };
        },
      );
      this.pending.push({ batch, finished });
    }
  }

  private async confirmAll(): Promise<void> {
    let blocked = false;
    for (const { batch, finished } of this.pending) {
      const result = await finished;
      if (blocked || !result.ok) {
        blocked = true;
        continue;
      }
      try {
        await this.options.confirm(batch);
      } catch (error) {
        this.failure ??= { error };
        blocked = true;
      }
    }
  }
}

export const runIndexingWindow = (options: WindowOptions) =>
  new IndexingWindow(options).run();
