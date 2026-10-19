import type { IndexingService } from '../modules/indexing/indexing.service.js';
import type { ReimportService } from '../modules/reimport/reimport.service.js';
import type { SyncService } from '../modules/sync/sync.service.js';
import { createWorkerTick } from './worker-tick.js';

const setup = () => {
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
    indexing: {
      run: async () => {
        calls.push('indexing');
      },
    } as unknown as IndexingService,
    signal,
  });
  return { tick, calls };
};

describe('createWorkerTick', () => {
  it('runs the steps in order', async () => {
    const { tick, calls } = setup();

    await tick();

    expect(calls).toEqual(['reimport', 'ensureTriggers', 'drain', 'indexing']);
  });
});
