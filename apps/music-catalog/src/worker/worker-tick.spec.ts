import type { Logger } from '../logger.js';
import type { IndexingService } from '../modules/indexing/indexing.service.js';
import type { LyricsImportService } from '../modules/lyrics/lyrics-import.service.js';
import type { LyricsLookupService } from '../modules/lyrics/lyrics-lookup.service.js';
import type { LyricsRefreshService } from '../modules/lyrics/lyrics-refresh.service.js';
import type { ReimportService } from '../modules/reimport/reimport.service.js';
import type { SyncService } from '../modules/sync/sync.service.js';
import { createWorkerTick } from './worker-tick.js';

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

type TickBehaviors = {
  importOnce?: () => Promise<unknown>;
  peekLyricless?: () => Promise<never[]>;
};

const setup = (behaviors: TickBehaviors = {}) => {
  const calls: string[] = [];
  const signal = new AbortController().signal;
  const tick = createWorkerTick({
    reimport: {
      maybeRun: async () => {
        calls.push('reimport');
        return 'idle' as const;
      },
    } as unknown as ReimportService,
    sync: {
      ensureTriggers: async () => {
        calls.push('ensureTriggers');
      },
      drain: async () => {
        calls.push('drain');
      },
    } as unknown as SyncService,
    lyrics: {
      importService: {
        importOnce: async () => {
          calls.push('lyricsImport');
          await (
            behaviors.importOnce ?? (async () => ({ matched: 0, saved: 0 }))
          )();
        },
      } as unknown as LyricsImportService,
      refreshService: {
        refreshOnce: async () => {
          calls.push('lyricsRefresh');
        },
      } as unknown as LyricsRefreshService,
      lookupService: {
        peekLyricless: async () => {
          calls.push('peekLyricless');
          return (await behaviors.peekLyricless?.()) ?? [];
        },
        fillLyricless: async () => {
          calls.push('fillLyricless');
        },
      } as unknown as LyricsLookupService,
    },
    indexing: {
      run: async () => {
        calls.push('indexing');
      },
    } as unknown as IndexingService,
    signal,
    logger: silentLogger,
  });
  return { tick, calls };
};

describe('createWorkerTick', () => {
  it('runs the steps in order', async () => {
    const { tick, calls } = setup();

    await tick();

    expect(calls).toEqual([
      'reimport',
      'ensureTriggers',
      'peekLyricless',
      'drain',
      'fillLyricless',
      'lyricsImport',
      'lyricsRefresh',
      'indexing',
    ]);
  });

  it('keeps indexing after a failed Lyrics import', async () => {
    const { tick, calls } = setup({
      importOnce: async () => {
        throw new Error('dump gone');
      },
    });

    await tick();

    expect(calls).toEqual([
      'reimport',
      'ensureTriggers',
      'peekLyricless',
      'drain',
      'fillLyricless',
      'lyricsImport',
      'lyricsRefresh',
      'indexing',
    ]);
  });

  it('keeps draining after a failed Lyrics peek', async () => {
    const { tick, calls } = setup({
      peekLyricless: async () => {
        throw new Error('api down');
      },
    });

    await tick();

    expect(calls).toEqual([
      'reimport',
      'ensureTriggers',
      'peekLyricless',
      'drain',
      'fillLyricless',
      'lyricsImport',
      'lyricsRefresh',
      'indexing',
    ]);
  });
});
