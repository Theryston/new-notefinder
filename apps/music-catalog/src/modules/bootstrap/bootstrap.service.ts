import type {
  CatalogDataset,
  MusicCatalogStatusResult,
} from '@notefinder/contracts';
import type { BootstrapRepository } from './bootstrap.repository.js';

export class BootstrapService {
  constructor(
    private readonly repository: BootstrapRepository,
    /** The dataset this deployment is configured for (`CATALOG_DATASET`). */
    private readonly configuredDataset: CatalogDataset,
  ) {}

  /**
   * Where the first import stands. The worker records it in the database; a
   * server that starts before the worker has written anything still answers,
   * with the import as not started yet.
   */
  async getStatus(): Promise<MusicCatalogStatusResult> {
    const state = await this.repository.getState();
    return state ?? { phase: 'restoring', dataset: this.configuredDataset };
  }
}
