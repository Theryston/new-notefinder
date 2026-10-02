import type { CatalogDataset } from '@notefinder/contracts';
import type { MbslaveClient } from '../../integrations/mbslave/mbslave-client.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { ReplicationRepository } from './replication.repository.js';
import {
  REPLICATION_POLL_INTERVAL_MS,
  ReplicationService,
} from './replication.service.js';

const silentLogger: Logger = {
  info: vi.fn(),
  warn: () => undefined,
  error: () => undefined,
};

const setup = (
  options: {
    dataset?: CatalogDataset;
    token?: string;
    tokenFile?: string;
    phases?: string[];
    recorded?: number | null;
    applied?: number | null;
    pending?: number;
    sync?: () => Promise<void>;
    /** Leaves `pollIntervalMs` unset, so the default applies. */
    defaultPollInterval?: boolean;
  } = {},
) => {
  const info = silentLogger.info as ReturnType<typeof vi.fn>;
  info.mockClear();
  const phases = options.phases ?? ['ready'];
  const bootstrap = {
    getStatus: vi.fn(async () => ({
      phase: phases.shift() ?? 'ready',
      dataset: 'full' as const,
    })),
  };
  const sequences = {
    lastRecordedSequence: vi.fn(async () => options.recorded ?? null),
    recordSequence: vi.fn(async () => undefined),
    readAppliedSequence: vi.fn(async () => options.applied ?? null),
  };
  const backlog = {
    countPending: vi.fn(async () => options.pending ?? 0),
  };
  const syncImpl = options.sync ?? (async () => undefined);
  const mbslave = { sync: vi.fn(syncImpl) };
  const service = new ReplicationService({
    sequences: sequences as unknown as ReplicationRepository,
    backlog,
    mbslave: mbslave as unknown as MbslaveClient,
    dataset: options.dataset ?? 'full',
    // `'token' in options` tells an explicit `token: undefined` (no token at
    // all) apart from an omitted one (the usual test token).
    musicbrainzToken: 'token' in options ? options.token : 'test-token',
    musicbrainzTokenFile: options.tokenFile,
    ...(options.defaultPollInterval ? {} : { pollIntervalMs: 1 }),
    logger: silentLogger,
  });
  return { service, bootstrap, sequences, backlog, mbslave, info };
};

const asBootstrap = (bootstrap: unknown): BootstrapService =>
  bootstrap as BootstrapService;

// Runs the loop until its first sync, which aborts the signal: every
// full-mode run below ends this way.
const runUntilFirstSync = async (parts: {
  service: ReplicationService;
  bootstrap: unknown;
  mbslave: { sync: ReturnType<typeof vi.fn> };
}): Promise<void> => {
  const controller = new AbortController();
  parts.mbslave.sync.mockImplementationOnce(async () => {
    controller.abort();
  });
  await expect(
    parts.service.run(controller.signal, asBootstrap(parts.bootstrap)),
  ).resolves.toBe('stopped');
};

describe('ReplicationService run: mode gating', () => {
  it('stays off in tiny mode without touching mbslave', async () => {
    const { service, bootstrap, mbslave, sequences, info } = setup({
      dataset: 'tiny',
      token: undefined,
    });

    await expect(
      service.run(new AbortController().signal, asBootstrap(bootstrap)),
    ).resolves.toBe('off');

    expect(mbslave.sync).not.toHaveBeenCalled();
    expect(sequences.lastRecordedSequence).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      'Replication stays off: tiny seeds no replication packets',
      { dataset: 'tiny' },
    );
  });

  it('fails fast in full mode without a token, before any sync', async () => {
    const { service, bootstrap, mbslave } = setup({
      token: undefined,
    });

    await expect(
      service.run(new AbortController().signal, asBootstrap(bootstrap)),
    ).rejects.toThrow('MBSLAVE_MUSICBRAINZ_TOKEN');

    expect(mbslave.sync).not.toHaveBeenCalled();
  });

  it('accepts the token file instead of the token itself', async () => {
    const { service, bootstrap, mbslave } = setup({
      token: undefined,
      tokenFile: '/run/secrets/mb-token',
      applied: 188_660,
    });

    await runUntilFirstSync({ service, bootstrap, mbslave });

    expect(mbslave.sync).toHaveBeenCalledTimes(1);
  });

  it('uses the default poll interval when none is configured', async () => {
    const { service, bootstrap, mbslave, info } = setup({
      applied: 188_660,
      defaultPollInterval: true,
    });

    await runUntilFirstSync({ service, bootstrap, mbslave });

    expect(info).toHaveBeenCalledWith('Starting continuous replication', {
      intervalMs: REPLICATION_POLL_INTERVAL_MS,
    });
  });

  it('waits for ready before the first sync, then replicates', async () => {
    const { service, bootstrap, mbslave } = setup({
      phases: ['restoring', 'indexing', 'ready'],
      applied: 188_660,
    });

    await runUntilFirstSync({ service, bootstrap, mbslave });

    expect(bootstrap.getStatus).toHaveBeenCalledTimes(3);
    expect(mbslave.sync).toHaveBeenCalledTimes(1);
  });

  it('stops while waiting when aborted, without syncing', async () => {
    const { service, bootstrap, mbslave } = setup({
      phases: ['restoring', 'restoring', 'restoring'],
    });
    const controller = new AbortController();
    const running = service.run(controller.signal, asBootstrap(bootstrap));
    controller.abort();

    await expect(running).resolves.toBe('stopped');

    expect(mbslave.sync).not.toHaveBeenCalled();
  });
});

describe('ReplicationService replicateOnce', () => {
  it('records the new sequence and logs it with the backlog', async () => {
    const { service, sequences, backlog, info } = setup({
      recorded: 188_657,
      applied: 188_660,
      pending: 7,
    });

    await expect(service.replicateOnce()).resolves.toEqual({
      previousSequence: 188_657,
      sequence: 188_660,
      pendingOutbox: 7,
    });

    expect(sequences.recordSequence).toHaveBeenCalledWith(188_660);
    expect(backlog.countPending).toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Applied replication packets', {
      previousSequence: 188_657,
      sequence: 188_660,
      pendingOutbox: 7,
    });
  });

  it('skips recording when no new packet landed', async () => {
    const { service, sequences } = setup({
      recorded: 188_660,
      applied: 188_660,
      pending: 0,
    });

    await expect(service.replicateOnce()).resolves.toMatchObject({
      sequence: 188_660,
      pendingOutbox: 0,
    });

    expect(sequences.recordSequence).not.toHaveBeenCalled();
  });

  it('skips recording while mbslave reports no sequence', async () => {
    const { service, sequences } = setup({ recorded: null, applied: null });

    await expect(service.replicateOnce()).resolves.toMatchObject({
      previousSequence: null,
      sequence: null,
    });

    expect(sequences.recordSequence).not.toHaveBeenCalled();
  });

  it('lets a failing sync propagate, so the container restarts', async () => {
    const { service, sequences } = setup({
      sync: async () => {
        throw new Error('mbslave sync failed (exit 1): boom');
      },
    });

    await expect(service.replicateOnce()).rejects.toThrow(
      'mbslave sync failed',
    );

    expect(sequences.recordSequence).not.toHaveBeenCalled();
  });
});

describe('ReplicationService report', () => {
  it('reports the recorded sequence with the backlog', async () => {
    const { service } = setup({ recorded: 188_660, pending: 12 });

    await expect(service.report()).resolves.toEqual({
      replicationSequence: 188_660,
      pendingOutbox: 12,
    });
  });

  it('reports a null sequence until the first packet lands', async () => {
    const { service } = setup({ recorded: null, pending: 0 });

    await expect(service.report()).resolves.toEqual({
      replicationSequence: null,
      pendingOutbox: 0,
    });
  });
});
