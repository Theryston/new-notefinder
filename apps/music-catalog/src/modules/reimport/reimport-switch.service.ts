import type { Logger } from '../../logger.js';

/** The outbox of the copy being retired: its entries die with it. */
type SwitchOutbox = {
  clearAll: () => Promise<void>;
};

/** The flip record, written on both copies (see below). */
type SwitchState = {
  markSwitched: (servingDatabaseUrl: string) => Promise<void>;
  dropDatabase: (databaseName: string) => Promise<void>;
};

/** The stall, forgotten once the new copy serves. */
type SwitchSequences = {
  clearStall: () => Promise<void>;
};

/** An index retired after the atomic swap. */
export type SwitchIndex = {
  deleteIndex: () => Promise<void>;
};

type SwitchGeneration = {
  /** The database identity held by the active generation marker. */
  serving: () => Promise<string>;
  /** The database identity expected after this copy is active. */
  next: () => Promise<string>;
  /** The swapped-out marker index, removed with the retired catalog index. */
  deleteNext: () => Promise<void>;
};

export type ReimportSwitchDeps = {
  servingOutbox: SwitchOutbox;
  servingState: SwitchState;
  nextState: SwitchState;
  sequences: SwitchSequences;
  nextIndex: SwitchIndex;
  generation: SwitchGeneration;
  /** The parallel database URL the reads flip to. */
  nextUrl: string;
  /** The retired database, dropped when cleaning up. */
  oldDatabaseName: string | undefined;
  /** Drop the retired database; otherwise it is kept for inspection. */
  cleanupOldCopy: boolean;
  /** Swaps recordings and generation marker pairs in one Meilisearch task. */
  swapBoth: () => Promise<void>;
  /**
   * Whether the flip record already points at the parallel copy. A rerun
   * that finds it skips the outbox clear and the swaps (replaying the swap
   * would swap back) and completes the flip record, the stall clear and the
   * cleanup instead. Absent in older callers; the wiring always provides it.
   */
  alreadySwitched?: () => Promise<boolean>;
  logger: Logger;
};

/**
 * Flips the serving copy to the parallel one. Every step only makes sense
 * once: a process restarted mid-flip replays it, skipping what already
 * happened (the flip record, then the generation marker) instead of
 * swapping back. The marker and recordings move in one atomic Meilisearch
 * task, so overlapping Recording IDs cannot confuse recovery.
 */
export class ReimportSwitchService {
  constructor(private readonly deps: ReimportSwitchDeps) {}

  async switchToCopy(): Promise<void> {
    // Past the flip record the serving reference may already point at the
    // new copy: its outbox is live backlog then, never to be cleared, and
    // the swaps must not run again. Before it, the clear is idempotent.
    const switched = (await this.deps.alreadySwitched?.()) ?? false;
    if (!switched) {
      // Entries queued against the retired copy are meaningless on the new
      // one; replication re-enqueues real lag from its cursor afterwards.
      await this.deps.servingOutbox.clearAll();
      if (!(await this.swapAlreadyRan())) {
        await this.swapIndexes();
      }
    }
    // The flip record lives on both copies: a restart reads the serving
    // one, and the retired database may be dropped afterwards. Upserts, so
    // replaying them changes nothing.
    await this.deps.servingState.markSwitched(this.deps.nextUrl);
    await this.deps.nextState.markSwitched(this.deps.nextUrl);
    await this.deps.sequences.clearStall();
    // After the swap the `*_next` indexes hold the retired copy.
    await this.deps.nextIndex.deleteIndex();
    await this.deps.generation.deleteNext();
    await this.dropRetiredDatabase();
  }

  // The marker pair is swapped atomically with the catalog pair, so its
  // database OID proves the exact swap outcome even when catalog IDs overlap.
  private async swapAlreadyRan(): Promise<boolean> {
    return (
      (await this.deps.generation.serving()) ===
      (await this.deps.generation.next())
    );
  }

  private async swapIndexes(): Promise<void> {
    await this.deps.swapBoth();
  }

  private async dropRetiredDatabase(): Promise<void> {
    const { oldDatabaseName, cleanupOldCopy, nextState, logger } = this.deps;
    if (!cleanupOldCopy || oldDatabaseName === undefined) {
      logger.info(
        'Reimport retired copy kept: drop its database once verified',
        { database: oldDatabaseName ?? 'unknown' },
      );
      return;
    }
    logger.info('Dropping the retired database', {
      database: oldDatabaseName,
    });
    await nextState.dropDatabase(oldDatabaseName);
  }
}
