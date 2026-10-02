import type {
  CatalogDataset,
  MusicCatalogStatusResult,
} from '@notefinder/contracts';
import { CatalogError } from '../../errors/catalog-error.js';
import type { BootstrapRepository } from './bootstrap.repository.js';

/**
 * Where `getStatus` reads the replication numbers when they are available:
 * the recorded sequence with the outbox backlog. Declared structurally so
 * this module never imports the replication module (the service behind it
 * satisfies it); `ReplicationService` is built for the server's status, and
 * left out wherever nothing answers `status` (unit contexts, the worker).
 */
export type ReplicationStatusSource = {
  report: () => Promise<{
    replicationSequence: number | null;
    pendingOutbox: number;
  }>;
};

export class BootstrapService {
  constructor(
    private readonly repository: BootstrapRepository,
    /** The dataset this deployment is configured for (`CATALOG_DATASET`). */
    private readonly configuredDataset: CatalogDataset,
    /** Adds the replication numbers to `getStatus`; absent without them. */
    private readonly replication?: ReplicationStatusSource,
  ) {}

  /**
   * Where the first import stands. The mbslave container and the worker
   * record it in the database; a server that starts before anything has been
   * written still answers, with the import as not started yet. With a
   * replication source, the answer also carries the last applied sequence
   * and the outbox backlog, read together so they describe the same moment.
   */
  async getStatus(): Promise<MusicCatalogStatusResult> {
    const state = await this.repository.getState();
    const base = state ?? {
      phase: 'restoring' as const,
      dataset: this.configuredDataset,
    };
    if (!this.replication) {
      return base;
    }
    return { ...base, ...(await this.replication.report()) };
  }

  /**
   * Refuses the request while the first import has not finished, for every
   * operation that reads the catalog (`status` is the one that may answer
   * meanwhile). The state is read on every call, so it follows the worker.
   */
  async assertReady(): Promise<void> {
    const { phase } = await this.getStatus();
    if (phase !== 'ready') {
      throw new CatalogError(
        'CATALOG_NOT_READY',
        `The catalog is still importing (phase: ${phase})`,
      );
    }
  }

  /**
   * The worker takes over from the mbslave container: the restore is done
   * (`restored`) and it starts indexing. A no-op in any other phase, so a
   * worker that restarts while indexing just goes on.
   */
  async startIndexing(): Promise<void> {
    await this.repository.advance({ from: 'restored', to: 'indexing' });
  }

  /** Every Recording is indexed: from now on the catalog answers searches. */
  async markReady(): Promise<void> {
    await this.repository.advance({ from: 'indexing', to: 'ready' });
  }
}
