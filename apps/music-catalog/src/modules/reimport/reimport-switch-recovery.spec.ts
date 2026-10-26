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
  options: { alreadySwitched?: boolean; servingGeneration?: string } = {},
) => {
  const calls: string[] = [];
  const deleteIndex = (name: string) =>
    vi.fn(async () => {
      calls.push(`${name}.deleteIndex`);
    });
  const servingGeneration = vi.fn(
    async () => options.servingGeneration ?? 'old-database-oid',
  );
  const swapBoth = vi.fn(async () => {
    calls.push('swapPairs(recordings+generation)');
  });
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
      dropDatabase: vi.fn(),
    },
    sequences: {
      clearStall: vi.fn(async () => {
        calls.push('sequences.clearStall');
      }),
    },
    nextIndex: { deleteIndex: deleteIndex('recordings_next') },
    generation: {
      serving: servingGeneration,
      next: async () => 'new-database-oid',
      deleteNext: deleteIndex('recordings_generation_next'),
    },
    nextUrl: 'postgres://host/next',
    oldDatabaseName: undefined,
    cleanupOldCopy: false,
    swapBoth,
    alreadySwitched: vi.fn(async () => options.alreadySwitched ?? false),
    logger: silentLogger,
  };
  return {
    service: new ReimportSwitchService(deps),
    deps,
    calls,
    swapBoth,
    servingGeneration,
  };
};

describe('ReimportSwitchService recovery', () => {
  it('swaps recordings and generation markers in one task on the first flip', async () => {
    const { service, deps, calls, swapBoth } = setup();

    await service.switchToCopy();

    expect(swapBoth).toHaveBeenCalledOnce();
    expect(calls).toEqual([
      'outbox.clearAll',
      'swapPairs(recordings+generation)',
      'serving.markSwitched(postgres://host/next)',
      'next.markSwitched(postgres://host/next)',
      'sequences.clearStall',
      'recordings_next.deleteIndex',
      'recordings_generation_next.deleteIndex',
    ]);
    expect(deps.nextIndex.deleteIndex).toHaveBeenCalledOnce();
  });

  it('completes the flip without swapping back when already switched', async () => {
    const { service, deps, calls, swapBoth, servingGeneration } = setup({
      alreadySwitched: true,
      servingGeneration: 'new-database-oid',
    });

    await service.switchToCopy();

    expect(swapBoth).not.toHaveBeenCalled();
    expect(servingGeneration).not.toHaveBeenCalled();
    expect(deps.servingOutbox.clearAll).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'serving.markSwitched(postgres://host/next)',
      'next.markSwitched(postgres://host/next)',
      'sequences.clearStall',
      'recordings_next.deleteIndex',
      'recordings_generation_next.deleteIndex',
    ]);
  });

  it('skips the swap when the exact next database marker proves it ran', async () => {
    const { service, calls, swapBoth } = setup({
      servingGeneration: 'new-database-oid',
    });

    await service.switchToCopy();

    expect(swapBoth).not.toHaveBeenCalled();
    expect(calls).toContain('outbox.clearAll');
    expect(calls).toContain('serving.markSwitched(postgres://host/next)');
  });

  it('swaps when the active marker identifies the old database', async () => {
    const { service, swapBoth } = setup({
      servingGeneration: 'old-database-oid',
    });

    await service.switchToCopy();

    expect(swapBoth).toHaveBeenCalledOnce();
  });
});
