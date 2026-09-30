import type {
  CatalogDataset,
  MusicCatalogStatusResult,
} from '@notefinder/contracts';
import { CatalogError } from '../../errors/catalog-error.js';
import type { BootstrapRepository } from './bootstrap.repository.js';

export class BootstrapService {
  constructor(
    private readonly repository: BootstrapRepository,
    /** The dataset this deployment is configured for (`CATALOG_DATASET`). */
    private readonly configuredDataset: CatalogDataset,
  ) {}

  /**
   * Where the first import stands. The mbslave container and the worker
   * record it in the database; a server that starts before anything has been
   * written still answers, with the import as not started yet.
   */
  async getStatus(): Promise<MusicCatalogStatusResult> {
    const state = await this.repository.getState();
    return state ?? { phase: 'restoring', dataset: this.configuredDataset };
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
