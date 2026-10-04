import type { Logger } from '../logger.js';
import type { IndexingService } from '../modules/indexing/indexing.service.js';
import type { MatchingRecording } from '../modules/lyrics/lyrics.repository.js';
import type { LyricsImportService } from '../modules/lyrics/lyrics-import.service.js';
import type { LyricsLookupService } from '../modules/lyrics/lyrics-lookup.service.js';
import type { LyricsRefreshService } from '../modules/lyrics/lyrics-refresh.service.js';
import type { ReimportService } from '../modules/reimport/reimport.service.js';
import type { SyncService } from '../modules/sync/sync.service.js';

type WorkerLyricsSteps = {
  importService: LyricsImportService;
  refreshService: LyricsRefreshService;
  lookupService: LyricsLookupService;
};

export type WorkerTickSteps = {
  reimport: ReimportService;
  sync: SyncService;
  lyrics: WorkerLyricsSteps;
  indexing: IndexingService;
  signal: AbortSignal;
  logger: Logger;
};

/**
 * One round of the worker's periodic work, in step order: the reimport
 * while one runs (a no-op otherwise), the outbox drain, the Lyrics import,
 * refresh and lookup, and the initial indexing. Kept beside the loop (not
 * a feature module): it only calls the steps in order, and the loop logs a
 * throw and retries on the next tick. Steps never overlap, so the work a
 * tick does needs no lock against itself. The Lyrics candidates are peeked
 * before the drain and filled after it: the drain never waits on the API,
 * however slow or broken it is, and the peek still sees the entries the
 * drain is about to carry to the index.
 */
export const createWorkerTick = (
  steps: WorkerTickSteps,
): (() => Promise<void>) => {
  const { reimport, sync, lyrics, indexing, signal, logger } = steps;
  return async () => {
    await reimport.maybeRun(signal);
    await sync.ensureTriggers();
    let lyricless: MatchingRecording[] = [];
    try {
      lyricless = await lyrics.lookupService.peekLyricless(signal);
    } catch (error) {
      logger.error('LRCLIB API lookup failed, continuing without Lyrics', {
        error,
      });
    }
    await sync.drain(signal);
    try {
      await lyrics.lookupService.fillLyricless(lyricless, signal);
    } catch (error) {
      logger.error('LRCLIB API lookup failed, continuing without Lyrics', {
        error,
      });
    }
    try {
      await lyrics.importService.importOnce(signal);
    } catch (error) {
      logger.error('LRCLIB import failed, continuing without Lyrics', {
        error,
      });
    }
    try {
      await lyrics.refreshService.refreshOnce(signal);
    } catch (error) {
      logger.error('LRCLIB refresh failed, serving the kept Lyrics', {
        error,
      });
    }
    await indexing.run(signal);
  };
};
