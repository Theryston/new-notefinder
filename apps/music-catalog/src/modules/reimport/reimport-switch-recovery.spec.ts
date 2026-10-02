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

// The same fakes as reimport-switch.service.spec.ts (left untouched), with
// the recovery seams on top: the single-task swap, the flip-record check and
// the sampled probe. Only the recovery plays here; the plain flip keeps its
// own spec.
const setup = (
  options: {
    alreadySwitched?: boolean;
    heldDocuments?: string[];
    probe?: string[];
    swapBothFails?: boolean;
  } = {},
) => {
  const calls: string[] = [];
  const held = new Set(options.heldDocuments ?? []);
  const switchIndex = (name: string) => ({
    swapWith: vi.fn(async (uid: string) => {
      calls.push(`${name}.swapWith(${uid})`);
    }),
    hasDocument: vi.fn(async (id: string) => held.has(id)),
    deleteIndex: vi.fn(async () => {
      calls.push(`${name}.deleteIndex`);
    }),
  });
  const nextIndex = switchIndex('recordings_next');
  const nextLyricsIndex = switchIndex('lyrics_next');
  const swapBoth =
    options.swapBothFails === true
      ? undefined
      : vi.fn(async () => {
          calls.push('swapPairs(recordings,lyrics)');
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
    servingIndex: switchIndex('recordings'),
    nextIndex,
    servingLyricsIndex: switchIndex('lyrics'),
    nextLyricsIndex,
    nextUrl: 'postgres://host/next',
    oldDatabaseName: undefined,
    cleanupOldCopy: false,
    swapBoth,
    alreadySwitched: vi.fn(async () => options.alreadySwitched ?? false),
    swapProbe: vi.fn(async () => options.probe ?? []),
    logger: silentLogger,
  };
  const service = new ReimportSwitchService(deps);
  return { service, deps, calls, swapBoth };
};

describe('ReimportSwitchService recovery', () => {
  it('swaps both pairs in one task on the first flip', async () => {
    const { service, deps, calls, swapBoth } = setup();

    await service.switchToCopy();

    expect(swapBoth).toHaveBeenCalledTimes(1);
    expect(deps.servingIndex.swapWith).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'outbox.clearAll',
      'swapPairs(recordings,lyrics)',
      'serving.markSwitched(postgres://host/next)',
      'next.markSwitched(postgres://host/next)',
      'sequences.clearStall',
      'recordings_next.deleteIndex',
      'lyrics_next.deleteIndex',
    ]);
  });

  it('completes the flip without swapping back when already switched', async () => {
    const { service, deps, calls, swapBoth } = setup({
      alreadySwitched: true,
    });

    await service.switchToCopy();

    expect(swapBoth).not.toHaveBeenCalled();
    expect(deps.servingOutbox.clearAll).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'serving.markSwitched(postgres://host/next)',
      'next.markSwitched(postgres://host/next)',
      'sequences.clearStall',
      'recordings_next.deleteIndex',
      'lyrics_next.deleteIndex',
    ]);
  });

  it('skips the swap when the probe proves it already ran', async () => {
    const { service, calls, swapBoth } = setup({
      alreadySwitched: false,
      heldDocuments: ['new-mbid-1', 'new-mbid-2'],
      probe: ['new-mbid-1', 'new-mbid-2'],
    });

    await service.switchToCopy();

    expect(swapBoth).not.toHaveBeenCalled();
    expect(calls[0]).toBe('outbox.clearAll');
    expect(calls).toContain('serving.markSwitched(postgres://host/next)');
  });

  it('swaps when the probe misses a sampled document', async () => {
    const { service, swapBoth } = setup({
      alreadySwitched: false,
      heldDocuments: ['new-mbid-1'],
      probe: ['new-mbid-1', 'new-mbid-2'],
    });

    await service.switchToCopy();

    expect(swapBoth).toHaveBeenCalledTimes(1);
  });

  it('swaps when no probe or document check is wired', async () => {
    const { service, deps, swapBoth } = setup();
    delete deps.swapProbe;
    delete deps.servingIndex.hasDocument;

    await service.switchToCopy();

    expect(swapBoth).toHaveBeenCalledTimes(1);
  });

  it('falls back to the two separate swaps without the single task', async () => {
    const { service, deps, calls } = setup({ swapBothFails: true });
    delete deps.swapBoth;

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
});
