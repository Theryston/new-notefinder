import type { CatalogDataset } from '@notefinder/contracts';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { RestoreService } from '../bootstrap/restore.service.js';
import type { ReplicationService } from '../replication/replication.service.js';
import { planReimport } from './reimport-plan.js';
import type { ReimportStateRepository } from './reimport-state.repository.js';

/** The parallel copy's own bootstrap state, read from its database. */
export type ParallelCopyState = {
  getState: () => Promise<{ phase: string } | undefined>;
};

export type ReimportRestoreDeps = {
  /** The serving copy's import state. */
  bootstrap: BootstrapService;
  replication: ReplicationService;
  /** The serving copy's reimport state. */
  state: ReimportStateRepository;
  /** The parallel copy's import state. */
  nextState: ParallelCopyState;
  /** The restore pointed at the parallel database. */
  restore: RestoreService;
  /** The mbslave release running here (`MBSLAVE_REF`), when known. */
  currentMbslaveRef: string | undefined;
  /** The serving database URL, to never restore into it. */
  servingDatabaseUrl: string;
  /** The parallel database URL the restore writes to. */
  nextDatabaseUrl: string;
  dataset: CatalogDataset;
  logger: Logger;
};

export type ReimportRestoreOutcome =
  | 'disabled'
  | 'idle'
  | 'waiting-compatible'
  | 'restored';

/**
 * Whether the container should tell the operator to configure the parallel
 * database: replication stalled on the yearly schema change in `full` mode,
 * but no `REIMPORT_DATABASE_URL` means no reimport ever rebuilds the catalog.
 * A pure predicate (not a service method) so the container entrypoint, which
 * owns no service instance here, can warn with the exact setting to set.
 */
export const needsParallelDatabaseWarning = (options: {
  dataset: CatalogDataset;
  stallReason: string | undefined;
  hasParallelDatabase: boolean;
}): boolean =>
  options.dataset === 'full' &&
  options.stallReason === 'schema-change' &&
  !options.hasParallelDatabase;

/**
 * The mbslave container's side of the blue-green reimport: once replication
 * stalls on the yearly schema change and this image runs a newer mbslave
 * than the stalled one, it restores the new dump into the parallel database
 * while the serving copy keeps answering, then hands the copy to the worker
 * (`indexing`). The serving database is never touched: the restore runs
 * entirely against the parallel one, which must be a fresh database (the
 * runbook creates one per reimport). An interrupted parallel restore is
 * redone from a clean state; a completed one is kept as is.
 */
export class ReimportRestoreService {
  constructor(private readonly deps: ReimportRestoreDeps) {}

  async maybeRestore(): Promise<ReimportRestoreOutcome> {
    const { bootstrap, replication, state, dataset, currentMbslaveRef } =
      this.deps;
    const [status, stall, reimport] = await Promise.all([
      bootstrap.getStatus(),
      replication.readStall(),
      state.get(),
    ]);
    const decision = planReimport({
      role: 'restore-container',
      dataset,
      bootstrapPhase: status.phase,
      stallReason: stall?.reason,
      stallMbslaveRef: stall?.mbslaveRef,
      currentMbslaveRef,
      reimport,
    });
    if (decision === 'start-restore') {
      await this.guardParallelDatabase();
      await state.start();
      this.deps.logger.info(
        'Starting the parallel restore for the schema change',
        { dataset },
      );
      await this.deps.restore.run();
      await state.advance({ from: 'restoring', to: 'indexing' });
      return 'restored';
    }
    if (decision === 'continue-restore') {
      await this.guardParallelDatabase();
      await this.deps.restore.run();
      await state.advance({ from: 'restoring', to: 'indexing' });
      return 'restored';
    }
    if (
      decision === 'disabled' ||
      decision === 'idle' ||
      decision === 'waiting-compatible'
    ) {
      return decision;
    }
    return 'idle';
  }

  // The parallel database must hold nothing but this reimport's copy: a
  // fresh database, or one this flow already started restoring. Anything
  // else (a serving or retired catalog) is refused instead of restored
  // over, as is pointing the restore at the serving database itself.
  private async guardParallelDatabase(): Promise<void> {
    const { servingDatabaseUrl, nextDatabaseUrl, nextState } = this.deps;
    if (nextDatabaseUrl === servingDatabaseUrl) {
      throw new Error(
        'Refusing the parallel restore: REIMPORT_DATABASE_URL is the ' +
          'serving database. Create a fresh database per reimport ' +
          '(see apps/music-catalog/CLAUDE.md).',
      );
    }
    const next = await nextState.getState();
    if (
      next !== undefined &&
      next.phase !== 'restoring' &&
      next.phase !== 'restored'
    ) {
      throw new Error(
        `Refusing the parallel restore: REIMPORT_DATABASE_URL holds a ` +
          `catalog in phase ${next.phase}. Create a fresh database per ` +
          `reimport (see apps/music-catalog/CLAUDE.md).`,
      );
    }
  }
}
