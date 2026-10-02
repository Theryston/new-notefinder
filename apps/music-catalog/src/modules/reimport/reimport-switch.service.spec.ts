import type { Logger } from '../../logger.js';
import {
  type ReimportSwitchDeps,
  ReimportSwitchService,
} from './reimport-switch.service.js';

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const setup = (
  options: { oldDatabaseName?: string; cleanupOldCopy?: boolean } = {},
) => {
  const calls: string[] = [];
  const info = vi.fn();
  const switchIndex = (name: string) => ({
    swapWith: vi.fn(async (uid: string) => {
      calls.push(`${name}.swapWith(${uid})`);
    }),
    deleteIndex: vi.fn(async () => {
      calls.push(`${name}.deleteIndex`);
    }),
  });
  const servingIndex = switchIndex('recordings');
  const nextIndex = switchIndex('recordings_next');
  const servingLyricsIndex = switchIndex('lyrics');
  const nextLyricsIndex = switchIndex('lyrics_next');
  const deps: ReimportSwitchDeps = {
    servingOutbox: {
      clearAll: vi.fn(async () => {
        calls.push('outbox.clearAll');
      }),
    },
    servingState: {
      markSwitched: vi.fn(async (url: string) => {
        calls.push(`serving.markSwitched(${url})`);
      }),
      dropDatabase: vi.fn(),
    },
    nextState: {
      markSwitched: vi.fn(async (url: string) => {
        calls.push(`next.markSwitched(${url})`);
      }),
      dropDatabase: vi.fn(async (name: string) => {
        calls.push(`next.dropDatabase(${name})`);
      }),
    },
    sequences: {
      clearStall: vi.fn(async () => {
        calls.push('sequences.clearStall');
      }),
    },
    servingIndex,
    nextIndex,
    servingLyricsIndex,
    nextLyricsIndex,
    nextUrl: 'postgres://host/next',
    oldDatabaseName: options.oldDatabaseName ?? 'serving',
    cleanupOldCopy: options.cleanupOldCopy ?? false,
    logger: { ...silentLogger, info },
  };
  const service = new ReimportSwitchService(deps);
  return { service, deps, calls, info };
};

describe('ReimportSwitchService', () => {
  it('clears the stale outbox, swaps, records the flip and deletes the old copy', async () => {
    const { service, calls } = setup();

    await service.switchToCopy();

    expect(calls).toEqual([
      'outbox.clearAll',
      'recordings.swapWith(recordings_next)',
      'lyrics.swapWith(lyrics_next)',
      'serving.markSwitched(postgres://host/next)',
      'next.markSwitched(postgres://host/next)',
      'sequences.clearStall',
      'recordings_next.deleteIndex',
      'lyrics_next.deleteIndex',
    ]);
  });

  it('drops the retired database when cleaning up', async () => {
    const { service, calls, info } = setup({ cleanupOldCopy: true });

    await service.switchToCopy();

    expect(calls).toContain('next.dropDatabase(serving)');
    expect(info).toHaveBeenCalledWith('Dropping the retired database', {
      database: 'serving',
    });
  });

  it('keeps the retired database without cleanup', async () => {
    const { service, calls, info } = setup({ cleanupOldCopy: false });

    await service.switchToCopy();

    expect(calls).not.toContain('next.dropDatabase(serving)');
    expect(info).toHaveBeenCalledWith(
      'Reimport retired copy kept: drop its database once verified',
      { database: 'serving' },
    );
  });
});
