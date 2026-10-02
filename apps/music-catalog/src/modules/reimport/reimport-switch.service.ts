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
  logger: Logger;
};

/**
 * Flips the serving copy to the parallel one. Every step only makes sense
 * once, and every step but the swap is idempotent, so a process restarted
 * mid-flip replays it harmlessly (the swap itself is one atomic
 * Meilisearch task; see the runbook for its sub-second crash window).
 */
export class ReimportSwitchService {
  constructor(private readonly deps: ReimportSwitchDeps) {}

  async switchToCopy(): Promise<void> {
    const { servingIndex, servingLyricsIndex, nextIndex, nextLyricsIndex } =
      this.deps;
    // Entries queued against the retired copy are meaningless on the new
    // one; replication re-enqueues real lag from its cursor afterwards.
    await this.deps.servingOutbox.clearAll();
    await servingIndex.swapWith(RECORDINGS_NEXT_INDEX.uid);
    await servingLyricsIndex.swapWith(LYRICS_NEXT_INDEX.uid);
    // The flip record lives on both copies: a restart reads the serving
    // one, and the retired database may be dropped afterwards.
    await this.deps.servingState.markSwitched(this.deps.nextUrl);
    await this.deps.nextState.markSwitched(this.deps.nextUrl);
    await this.deps.sequences.clearStall();
    // After the swap the `*_next` indexes hold the retired copy.
    await nextIndex.deleteIndex();
    await nextLyricsIndex.deleteIndex();
    await this.dropRetiredDatabase();
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
