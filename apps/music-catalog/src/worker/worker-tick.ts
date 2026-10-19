import type { IndexingService } from '../modules/indexing/indexing.service.js';
import type { ReimportService } from '../modules/reimport/reimport.service.js';
import type { SyncService } from '../modules/sync/sync.service.js';

export type WorkerTickSteps = {
  reimport: ReimportService;
  sync: SyncService;
  indexing: IndexingService;
  signal: AbortSignal;
};

/**
 * One round of the worker's periodic work, in step order: the reimport
 * while one runs (a no-op otherwise), the outbox drain, and the initial
 * indexing. Kept beside the loop (not a feature module): it only calls the
 * steps in order, and the loop logs a throw and retries on the next tick.
 * Steps never overlap, so the work a tick does needs no lock against itself.
 */
export const createWorkerTick = (
  steps: WorkerTickSteps,
): (() => Promise<void>) => {
  const { reimport, sync, indexing, signal } = steps;
  return async () => {
    await reimport.maybeRun(signal);
    await sync.ensureTriggers();
    await sync.drain(signal);
    await indexing.run(signal);
  };
};
