import type { BootstrapPhase, CatalogDataset } from '@notefinder/contracts';
import { and, eq } from 'drizzle-orm';
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

  /**
   * Moves the phase from `from` to `to`, only if it is still `from`: a worker
   * that lost a race with another one (or with a restart) changes nothing
   * instead of overwriting what the other recorded.
   */
  async advance(move: {
    from: BootstrapPhase;
    to: BootstrapPhase;
  }): Promise<void> {
    await this.db
      .update(bootstrapState)
      .set({ phase: move.to })
      .where(
        and(eq(bootstrapState.id, true), eq(bootstrapState.phase, move.from)),
      );
  }
}
