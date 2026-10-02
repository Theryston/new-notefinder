import type { MbslaveClient } from '../../integrations/mbslave/mbslave-client.js';
import type { Logger } from '../../logger.js';
import type {
  RecordReplicationStall,
  ReplicationRepository,
} from './replication.repository.js';
import { ReplicationService } from './replication.service.js';

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const setup = (
  options: {
    recorded?: number | null;
    applied?: number | null;
    pending?: number;
    stall?:
      | { reason: 'schema-change'; detail: string | null; mbslaveRef?: string }
      | undefined;
    sync?: () => Promise<void>;
    mbslaveRef?: string;
  } = {},
) => {
  const sequences = {
    lastRecordedSequence: vi.fn(async () => options.recorded ?? null),
    recordSequence: vi.fn(async () => undefined),
    readAppliedSequence: vi.fn(async () => options.applied ?? null),
  };
  const stalls = {
    readStall: vi.fn(async () =>
      options.stall === undefined
        ? undefined
        : { mbslaveRef: null, ...options.stall },
    ),
    recordStall: vi.fn(async (stall: RecordReplicationStall) => {
      recorded.push(stall);
    }),
    clearStall: vi.fn(async () => undefined),
  };
  const backlog = { countPending: vi.fn(async () => options.pending ?? 0) };
  const recorded: RecordReplicationStall[] = [];
  const mbslave = { sync: vi.fn(options.sync ?? (async () => undefined)) };
  const service = new ReplicationService({
    sequences: sequences as unknown as ReplicationRepository,
    backlog,
    mbslave: mbslave as unknown as MbslaveClient,
    dataset: 'full',
    musicbrainzToken: 'test-token',
    stalls,
    mbslaveRef: options.mbslaveRef ?? 'v32.0.0',
    pollIntervalMs: 1,
    logger: silentLogger,
  });
  return { service, sequences, stalls, backlog, mbslave, recorded };
};

describe('ReplicationService schema-change stall', () => {
  it('records the stall when sync fails with a schema mismatch', async () => {
    const { service, stalls, sequences } = setup({
      recorded: 188_660,
      applied: 188_660,
      sync: async () => {
        throw new Error('mbslave sync failed (exit 1): Mismatched schema');
      },
    });

    await expect(service.replicateOnce()).rejects.toThrow('Mismatched schema');

    expect(stalls.recordStall).toHaveBeenCalledWith({
      reason: 'schema-change',
      detail: 'mbslave sync failed (exit 1): Mismatched schema',
      mbslaveRef: 'v32.0.0',
    });
    expect(sequences.recordSequence).not.toHaveBeenCalled();
  });

  it('truncates a long mismatch message for status', async () => {
    const { service, recorded } = setup({
      sync: async () => {
        throw new Error(`Mismatched schema ${'x'.repeat(500)}`);
      },
    });

    await expect(service.replicateOnce()).rejects.toThrow();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.detail).toHaveLength(300);
  });

  it('records nothing when any other failure propagates', async () => {
    const { service, stalls } = setup({
      sync: async () => {
        throw new Error('mbslave sync failed (exit 1): boom');
      },
    });

    await expect(service.replicateOnce()).rejects.toThrow('boom');

    expect(stalls.recordStall).not.toHaveBeenCalled();
  });

  it('clears the stall once sync applies packets again', async () => {
    const { service, stalls } = setup({ recorded: 188_660, applied: 188_661 });

    await service.replicateOnce();

    expect(stalls.clearStall).toHaveBeenCalledTimes(1);
  });

  it('reports the stall in the status numbers', async () => {
    const { service } = setup({
      recorded: 188_660,
      pending: 3,
      stall: { reason: 'schema-change', detail: 'Mismatched schema' },
    });

    await expect(service.report()).resolves.toEqual({
      replicationSequence: 188_660,
      pendingOutbox: 3,
      replicationStalled: {
        reason: 'schema-change',
        detail: 'Mismatched schema',
      },
    });
  });

  it('omits the detail when the stall holds none', async () => {
    const { service } = setup({
      stall: { reason: 'schema-change', detail: null },
    });

    await expect(service.report()).resolves.toEqual({
      replicationSequence: null,
      pendingOutbox: 0,
      replicationStalled: { reason: 'schema-change' },
    });
  });

  it('reads and clears the stall through the store', async () => {
    const { service, stalls } = setup({
      stall: { reason: 'schema-change', detail: null },
    });

    await expect(service.readStall()).resolves.toEqual({
      reason: 'schema-change',
      detail: null,
      mbslaveRef: null,
    });
    await service.clearStall();

    expect(stalls.clearStall).toHaveBeenCalledTimes(1);
  });
});
