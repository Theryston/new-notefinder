import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import {
  type ReimportCopy,
  ReimportService,
  readReimportStatus,
} from './reimport.service.js';
import type {
  ReimportState,
  ReimportStateRepository,
} from './reimport-state.repository.js';

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const setup = (
  options: {
    phase?: string;
    dataset?: 'tiny' | 'full';
    reimport?: ReimportState;
    copy?: ReimportCopy;
  } = {},
) => {
  const bootstrap = {
    getStatus: vi.fn(async () => ({
      phase: options.phase ?? 'ready',
      dataset: options.dataset ?? 'full',
    })),
  };
  const state = {
    get: vi.fn(async () => options.reimport),
    start: vi.fn(async () => undefined),
    advance: vi.fn(async () => undefined),
    setProgress: vi.fn(async () => undefined),
    markSwitched: vi.fn(async () => undefined),
    dropDatabase: vi.fn(async () => undefined),
  };
  const copy: ReimportCopy = options.copy ?? {
    ensureTriggersCopy: vi.fn(async () => undefined),
    rematchLyrics: vi.fn(async () => ({ carried: 9, dropped: 1 })),
    indexCopy: vi.fn(
      async (
        _signal: AbortSignal,
        onProgress: (fraction: number) => Promise<void>,
      ) => {
        await onProgress(0.5);
      },
    ),
    switchToCopy: vi.fn(async () => undefined),
  };
  const service = new ReimportService({
    bootstrap: bootstrap as unknown as BootstrapService,
    state: state as unknown as ReimportStateRepository,
    dataset: options.dataset ?? 'full',
    copy,
    logger: silentLogger,
  });
  return { service, bootstrap, state, copy };
};

describe('ReimportService', () => {
  it('stays disabled without a parallel copy, reading nothing', async () => {
    const bootstrap = {
      getStatus: vi.fn(async () => ({ phase: 'ready', dataset: 'full' })),
    };
    const state = { get: vi.fn() };
    const service = new ReimportService({
      bootstrap: bootstrap as unknown as BootstrapService,
      state: state as unknown as ReimportStateRepository,
      dataset: 'full',
      logger: silentLogger,
    });

    await expect(service.maybeRun(new AbortController().signal)).resolves.toBe(
      'disabled',
    );

    expect(state.get).not.toHaveBeenCalled();
  });

  it('stays idle outside full mode and before the first import finishes', async () => {
    const tiny = setup({ dataset: 'tiny' });
    await expect(
      tiny.service.maybeRun(new AbortController().signal),
    ).resolves.toBe('disabled');

    const restoring = setup({ phase: 'restoring' });
    await expect(
      restoring.service.maybeRun(new AbortController().signal),
    ).resolves.toBe('idle');
  });

  it('waits while the container restores the parallel copy', async () => {
    const { service, copy } = setup({
      reimport: { phase: 'restoring', progressPct: null, detail: null },
    });

    await expect(service.maybeRun(new AbortController().signal)).resolves.toBe(
      'waiting-restore',
    );

    expect(copy.ensureTriggersCopy).not.toHaveBeenCalled();
  });

  it('indexes the parallel copy, then hands it to the switch', async () => {
    const { service, state, copy } = setup({
      reimport: { phase: 'indexing', progressPct: null, detail: null },
    });

    await expect(service.maybeRun(new AbortController().signal)).resolves.toBe(
      'indexed',
    );

    expect(copy.ensureTriggersCopy).toHaveBeenCalledTimes(1);
    expect(copy.rematchLyrics).toHaveBeenCalledTimes(1);
    expect(copy.indexCopy).toHaveBeenCalledTimes(1);
    expect(state.setProgress).toHaveBeenNthCalledWith(1, 0);
    expect(state.setProgress).toHaveBeenCalledWith(50);
    expect(state.setProgress).toHaveBeenCalledWith(100);
    expect(state.advance).toHaveBeenCalledWith({
      from: 'indexing',
      to: 'switching',
    });
  });

  it('switches the serving copy over', async () => {
    const { service, copy } = setup({
      reimport: { phase: 'switching', progressPct: null, detail: null },
    });

    await expect(service.maybeRun(new AbortController().signal)).resolves.toBe(
      'switched',
    );

    expect(copy.switchToCopy).toHaveBeenCalledTimes(1);
  });

  it('reports the reimport phase with its progress', async () => {
    const { state } = setup({
      reimport: { phase: 'indexing', progressPct: 42, detail: null },
    });

    await expect(readReimportStatus(state)).resolves.toEqual({
      phase: 'indexing',
      progressPct: 42,
    });
  });

  it('reports nothing without a running reimport', async () => {
    const { state } = setup();
    await expect(readReimportStatus(state)).resolves.toBeUndefined();

    const switched = setup({
      reimport: { phase: 'switched', progressPct: null, detail: 'next' },
    });
    await expect(readReimportStatus(switched.state)).resolves.toBeUndefined();
  });
});
