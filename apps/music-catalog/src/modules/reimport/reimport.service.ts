import type {
  CatalogDataset,
  MusicCatalogReimportStatus,
} from '@notefinder/contracts';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import { planReimport } from './reimport-plan.js';
import type {
  ReimportState,
  ReimportStateRepository,
} from './reimport-state.repository.js';

/**
 * The parallel copy the worker builds while the serving copy answers: the
 * change triggers on it, the carried Lyrics with the match rerun (no
 * download), the `*_next` search indexes, and the flip itself. Every step
 * only touches the parallel copy; the serving copy flips over atomically
 * inside `switchToCopy`.
 */
export type ReimportCopy = {
  /** Installs the change triggers on the parallel copy. */
  ensureTriggersCopy: () => Promise<void>;
  /** Carries the kept Lyrics over, rerunning the strict match. */
  rematchLyrics: (
    signal: AbortSignal,
  ) => Promise<{ carried: number; dropped: number }>;
  /** Indexes the parallel copy into the `*_next` indexes. */
  indexCopy: (
    signal: AbortSignal,
    onProgress: (fraction: number) => Promise<void>,
  ) => Promise<void>;
  /** Swaps the indexes, flips the reads and deletes the old copy. */
  switchToCopy: (signal: AbortSignal) => Promise<void>;
};

export type ReimportServiceDeps = {
  bootstrap: BootstrapService;
  state: ReimportStateRepository;
  dataset: CatalogDataset;
  /** Absent without a parallel database: the worker never reimports. */
  copy?: ReimportCopy;
  logger: Logger;
};

export type ReimportTickOutcome =
  | 'disabled'
  | 'idle'
  | 'waiting-restore'
  | 'indexed'
  | 'switched';

/**
 * One step of the worker's side of the blue-green reimport. The first
 * import's phase stays `ready` throughout (the reimport has its own state),
 * so `search` and `getRecording` never answer `CATALOG_NOT_READY` for it. A
 * throw aborts the tick (the loop logs it and retries): every step is
 * idempotent, so an interrupted reimport resumes on the parallel copy
 * without touching the serving one.
 */
export class ReimportService {
  constructor(private readonly deps: ReimportServiceDeps) {}

  async maybeRun(signal: AbortSignal): Promise<ReimportTickOutcome> {
    const { bootstrap, state, dataset, copy } = this.deps;
    if (copy === undefined) {
      return 'disabled';
    }
    const [status, reimport] = await Promise.all([
      bootstrap.getStatus(),
      state.get(),
    ]);
    const decision = planReimport({
      role: 'worker',
      dataset,
      bootstrapPhase: status.phase,
      stallReason: undefined,
      stallMbslaveRef: undefined,
      currentMbslaveRef: undefined,
      reimport,
    });
    if (decision === 'run-indexing') {
      await this.indexCopy(signal, copy);
      return 'indexed';
    }
    if (decision === 'run-switch') {
      await copy.switchToCopy(signal);
      this.deps.logger.info('Reimport switched to the parallel copy');
      return 'switched';
    }
    if (decision === 'wait-restore') {
      return 'waiting-restore';
    }
    if (decision === 'disabled' || decision === 'idle') {
      return decision;
    }
    return 'idle';
  }

  private async indexCopy(
    signal: AbortSignal,
    copy: ReimportCopy,
  ): Promise<void> {
    const { state, logger } = this.deps;
    await state.setProgress(0);
    await copy.ensureTriggersCopy();
    const { carried, dropped } = await copy.rematchLyrics(signal);
    logger.info('Reimport carried the kept Lyrics to the parallel copy', {
      carried,
      dropped,
    });
    await copy.indexCopy(signal, async (fraction) => {
      await state.setProgress(clampProgress(fraction));
    });
    await state.advance({ from: 'indexing', to: 'switching' });
    await state.setProgress(100);
  }
}

const clampProgress = (fraction: number): number =>
  Math.min(100, Math.max(0, Math.round(fraction * 100)));

/**
 * What `status` reports about the reimport: its phase with the indexing
 * progress. Absent while no reimport runs (and after the flip, which is
 * steady state, not progress). A plain function (not a service method) so
 * the status wiring needs no service instance, which would circle back to
 * the bootstrap service it reports through.
 */
export const readReimportStatus = async (state: {
  get: () => Promise<ReimportState | undefined>;
}): Promise<MusicCatalogReimportStatus | undefined> => {
  const running = await state.get();
  if (
    running === undefined ||
    (running.phase !== 'restoring' &&
      running.phase !== 'indexing' &&
      running.phase !== 'switching')
  ) {
    return undefined;
  }
  return {
    phase: running.phase,
    ...(running.progressPct === null
      ? {}
      : { progressPct: running.progressPct }),
  };
};
