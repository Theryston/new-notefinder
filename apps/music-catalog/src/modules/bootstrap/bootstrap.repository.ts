import type { BootstrapPhase, CatalogDataset } from '@notefinder/contracts';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';
import { bootstrapState } from '../../database/schema/bootstrap-state.js';

export type BootstrapState = {
  phase: BootstrapPhase;
  dataset: CatalogDataset;
};

// Every schema `mbslave init --empty` creates (the spike's section 1): the
// MusicBrainz tables live in `musicbrainz`, the rest holds cover art, event
// art, statistics, documentation, wikidocs and replication bookkeeping.
const MBSLAVE_SCHEMAS = [
  'musicbrainz',
  'cover_art_archive',
  'event_art_archive',
  'statistics',
  'documentation',
  'wikidocs',
  'dbmirror2',
] as const;

export class BootstrapRepository {
  private readonly getDb: () => Database;

  constructor(db: DatabaseSource) {
    this.getDb = typeof db === 'function' ? db : () => db;
  }

  /** The recorded state, or undefined until the import writes it. */
  async getState(): Promise<BootstrapState | undefined> {
    const [state] = await this.getDb()
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
    await this.getDb()
      .update(bootstrapState)
      .set({ phase: move.to })
      .where(
        and(eq(bootstrapState.id, true), eq(bootstrapState.phase, move.from)),
      );
  }

  /**
   * Records that the mbslave container started the restore of `dataset`,
   * creating the single row or moving it back to `restoring`. A start that
   * crashes afterwards leaves this phase behind, which the next start reads
   * as an interrupted restore.
   */
  async beginRestore(dataset: CatalogDataset): Promise<void> {
    await this.getDb()
      .insert(bootstrapState)
      .values({ phase: 'restoring', dataset })
      .onConflictDoUpdate({
        target: bootstrapState.id,
        set: { phase: 'restoring', dataset },
      });
  }

  /**
   * Records that the dump is fully imported. Only moves from `restoring`, so
   * a concurrent start that began a redo in the meantime is never marked done
   * behind its back.
   */
  async finishRestore(): Promise<void> {
    await this.advance({ from: 'restoring', to: 'restored' });
  }

  /**
   * Drops every schema mbslave creates, so an interrupted restore is redone
   * from a clean state (`init --empty` is not idempotent and `import` skips
   * tables that already hold rows). Schemas that do not exist are left
   * alone; our own `music_catalog` schema is never touched.
   */
  async clearMusicBrainz(): Promise<void> {
    const schemas = MBSLAVE_SCHEMAS.map((schema) => sql.identifier(schema));
    await this.getDb().execute(
      sql`drop schema if exists ${sql.join(schemas, sql`, `)} cascade`,
    );
  }
}
