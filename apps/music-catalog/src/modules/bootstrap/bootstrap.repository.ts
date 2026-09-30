import type { BootstrapPhase, CatalogDataset } from '@notefinder/contracts';
import type { Database } from '../../database/database.js';
import { bootstrapState } from '../../database/schema/bootstrap-state.js';

export type BootstrapState = {
  phase: BootstrapPhase;
  dataset: CatalogDataset;
};

export class BootstrapRepository {
  constructor(private readonly db: Database) {}

  /** The recorded state, or undefined until the import writes it. */
  async getState(): Promise<BootstrapState | undefined> {
    const [state] = await this.db
      .select({
        phase: bootstrapState.phase,
        dataset: bootstrapState.dataset,
      })
      .from(bootstrapState)
      .limit(1);
    return state;
  }
}
