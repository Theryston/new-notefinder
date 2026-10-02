import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { RestoreService } from '../bootstrap/restore.service.js';
import type { ReplicationService } from '../replication/replication.service.js';
import {
  type ParallelCopyState,
  ReimportRestoreService,
} from './reimport-restore.service.js';
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
    stall?: { reason: 'schema-change'; mbslaveRef: string | null } | undefined;
    reimport?: ReimportState;
    nextPhase?: string;
    servingDatabaseUrl?: string;
    nextDatabaseUrl?: string;
    currentMbslaveRef?: string;
  } = {},
) => {
  const bootstrap = {
    getStatus: vi.fn(async () => ({
      phase: options.phase ?? 'ready',
      dataset: 'full',
    })),
  };
  const replication = {
    readStall: vi.fn(async () => options.stall),
  };
  const state = {
    get: vi.fn(async () => options.reimport),
    start: vi.fn(async () => undefined),
    advance: vi.fn(async () => undefined),
    setProgress: vi.fn(async () => undefined),
    markSwitched: vi.fn(async () => undefined),
    dropDatabase: vi.fn(async () => undefined),
  };
  const nextState = {
    getState: vi.fn(async () =>
      options.nextPhase === undefined
        ? undefined
        : { phase: options.nextPhase },
    ),
  };
  const restore = { run: vi.fn(async () => 'restored' as const) };
  const service = new ReimportRestoreService({
    bootstrap: bootstrap as unknown as BootstrapService,
    replication: replication as unknown as ReplicationService,
    state: state as unknown as ReimportStateRepository,
    nextState: nextState as ParallelCopyState,
    restore: restore as unknown as RestoreService,
    currentMbslaveRef: options.currentMbslaveRef ?? 'v32.0.0',
    servingDatabaseUrl: options.servingDatabaseUrl ?? 'postgres://host/serving',
    nextDatabaseUrl: options.nextDatabaseUrl ?? 'postgres://host/next',
    dataset: 'full',
    logger: silentLogger,
  });
  return { service, state, nextState, restore };
};

const stalled = { reason: 'schema-change' as const, mbslaveRef: 'v31.0.1' };

describe('ReimportRestoreService', () => {
  it('waits for a compatible mbslave before touching anything', async () => {
    const { service, state, restore } = setup({
      stall: stalled,
      currentMbslaveRef: 'v31.0.1',
    });

    await expect(service.maybeRestore()).resolves.toBe('waiting-compatible');

    expect(state.start).not.toHaveBeenCalled();
    expect(restore.run).not.toHaveBeenCalled();
  });

  it('restores the parallel copy once the bumped image runs', async () => {
    const { service, state, restore } = setup({ stall: stalled });

    await expect(service.maybeRestore()).resolves.toBe('restored');

    expect(state.start).toHaveBeenCalledTimes(1);
    expect(restore.run).toHaveBeenCalledTimes(1);
    expect(state.advance).toHaveBeenCalledWith({
      from: 'restoring',
      to: 'indexing',
    });
  });

  it('hands over a completed parallel copy without restoring it again', async () => {
    const { service, state, restore } = setup({
      stall: stalled,
      reimport: { phase: 'restoring', progressPct: null, detail: null },
      nextPhase: 'restored',
    });

    await expect(service.maybeRestore()).resolves.toBe('restored');

    expect(restore.run).toHaveBeenCalledTimes(1);
    expect(state.advance).toHaveBeenCalledWith({
      from: 'restoring',
      to: 'indexing',
    });
  });

  it('redoes an interrupted parallel restore from a clean state', async () => {
    const { service, restore } = setup({
      stall: stalled,
      reimport: { phase: 'restoring', progressPct: null, detail: null },
      nextPhase: 'restoring',
    });

    await expect(service.maybeRestore()).resolves.toBe('restored');

    expect(restore.run).toHaveBeenCalledTimes(1);
  });

  it('refuses to restore into the serving database', async () => {
    const { service, restore } = setup({
      stall: stalled,
      servingDatabaseUrl: 'postgres://host/same',
      nextDatabaseUrl: 'postgres://host/same',
    });

    await expect(service.maybeRestore()).rejects.toThrow(
      'the serving database',
    );

    expect(restore.run).not.toHaveBeenCalled();
  });

  it('refuses a parallel database that holds a serving catalog', async () => {
    const { service, restore } = setup({
      stall: stalled,
      nextPhase: 'ready',
    });

    await expect(service.maybeRestore()).rejects.toThrow('holds a catalog');

    expect(restore.run).not.toHaveBeenCalled();
  });

  it('stays idle without a schema-change stall', async () => {
    const { service, restore } = setup();

    await expect(service.maybeRestore()).resolves.toBe('idle');

    expect(restore.run).not.toHaveBeenCalled();
  });
});
