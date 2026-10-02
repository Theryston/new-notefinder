import { LYRICS_NEXT_INDEX } from '../../lib/lyrics-index.js';
import { RECORDINGS_NEXT_INDEX } from '../../lib/recordings-index.js';
import type { Logger } from '../../logger.js';

/** The outbox of the copy being retired: its entries die with it. */
export type SwitchOutbox = {
  clearAll: () => Promise<void>;
};

/** The flip record, written on both copies (see below). */
export type SwitchState = {
  markSwitched: (servingDatabaseUrl: string) => Promise<void>;
  dropDatabase: (databaseName: string) => Promise<void>;
};

/** The stall, forgotten once the new copy serves. */
export type SwitchSequences = {
  clearStall: () => Promise<void>;
};

/** One side of the atomic index swap. */
export type SwitchIndex = {
  swapWith: (otherUid: string) => Promise<void>;
  /** Absent in older fakes: then the swap always runs (see below). */
  hasDocument?: (id: string) => Promise<boolean>;
  deleteIndex: () => Promise<void>;
};

export type ReimportSwitchDeps = {
  servingOutbox: SwitchOutbox;
  servingState: SwitchState;
  nextState: SwitchState;
  sequences: SwitchSequences;
  servingIndex: SwitchIndex;
  nextIndex: SwitchIndex;
  servingLyricsIndex: SwitchIndex;
  nextLyricsIndex: SwitchIndex;
  /** The parallel database URL the reads flip to. */
  nextUrl: string;
  /** The retired database, dropped when cleaning up. */
  oldDatabaseName: string | undefined;
  /** Drop the retired database; otherwise it is kept for inspection. */
  cleanupOldCopy: boolean;
  /**
   * Swaps both index pairs in one Meilisearch task (see `swapPairs`):
   * without it the flip falls back to the two separate swaps, with a
   * half-swapped catalog when the process dies between them. Absent in older
   * callers; the wiring always provides it.
   */
  swapBoth?: () => Promise<void>;
  /**
   * Whether the flip record already points at the parallel copy. A rerun
   * that finds it skips the outbox clear and the swaps (replaying the swap
   * would swap back) and completes the flip record, the stall clear and the
   * cleanup instead. Absent in older callers; the wiring always provides it.
   */
  alreadySwitched?: () => Promise<boolean>;
  /**
   * A sample of the parallel copy's document ids. When the flip record is
   * missing but every sampled id is already in the serving index, the swap
   * ran and the process died before recording it: the swaps are skipped the
   * same way. Empty or absent (older callers): the swap always runs.
   */
  swapProbe?: () => Promise<string[]>;
  logger: Logger;
};

/**
 * Flips the serving copy to the parallel one. Every step only makes sense
 * once: a process restarted mid-flip replays it, skipping what already
 * happened (the flip record, then the sampled probe) instead of swapping
 * back, so the rerun completes the flip. The swap itself is one atomic
 * Meilisearch task; the residual crash window is the flip record right
 * after it (see the runbook), where a rerun finds the sampled documents and
 * still completes forward.
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
    await this.deps.nextLyricsIndex.deleteIndex();
    await this.dropRetiredDatabase();
  }

  // True when the serving index already holds every sampled document of the
  // parallel copy: the swap ran. A sample cannot prove it exactly (an
  // identical copy is indistinguishable and harmless either way), but with
  // hundreds of ids a differing copy is missed only by extreme bad luck;
  // the runbook's count check catches even that.
  private async swapAlreadyRan(): Promise<boolean> {
    const probe = (await this.deps.swapProbe?.()) ?? [];
    if (probe.length === 0) {
      return false;
    }
    for (const id of probe) {
      if (!((await this.deps.servingIndex.hasDocument?.(id)) ?? false)) {
        return false;
      }
    }
    return true;
  }

  private async swapIndexes(): Promise<void> {
    const both = this.deps.swapBoth;
    if (both !== undefined) {
      await both();
      return;
    }
    const { servingIndex, servingLyricsIndex } = this.deps;
    await servingIndex.swapWith(RECORDINGS_NEXT_INDEX.uid);
    await servingLyricsIndex.swapWith(LYRICS_NEXT_INDEX.uid);
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
