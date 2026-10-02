import type { BootstrapRepository } from './bootstrap.repository.js';
import {
  BootstrapService,
  type ReplicationStatusSource,
} from './bootstrap.service.js';

const setup = (
  state: Awaited<ReturnType<BootstrapRepository['getState']>>,
  replication?: ReplicationStatusSource,
) => {
  const repository = { getState: vi.fn(async () => state) };
  const service = new BootstrapService(
    repository as unknown as BootstrapRepository,
    'full',
    replication,
  );
  return { service, repository };
};

describe('BootstrapService getStatus with replication', () => {
  it('adds the recorded sequence and the backlog to the recorded phase', async () => {
    const replication = {
      report: vi.fn(async () => ({
        replicationSequence: 188_660,
        pendingOutbox: 12,
      })),
    };
    const { service } = setup({ phase: 'ready', dataset: 'full' }, replication);

    await expect(service.getStatus()).resolves.toEqual({
      phase: 'ready',
      dataset: 'full',
      replicationSequence: 188_660,
      pendingOutbox: 12,
    });
    expect(replication.report).toHaveBeenCalledTimes(1);
  });

  it('reports a null sequence until the first packet lands', async () => {
    const { service } = setup(
      { phase: 'indexing', dataset: 'full' },
      {
        report: async () => ({ replicationSequence: null, pendingOutbox: 0 }),
      },
    );

    await expect(service.getStatus()).resolves.toEqual({
      phase: 'indexing',
      dataset: 'full',
      replicationSequence: null,
      pendingOutbox: 0,
    });
  });

  it('keeps the configured dataset before the import records anything', async () => {
    const { service } = setup(undefined, {
      report: async () => ({ replicationSequence: null, pendingOutbox: 0 }),
    });

    await expect(service.getStatus()).resolves.toEqual({
      phase: 'restoring',
      dataset: 'full',
      replicationSequence: null,
      pendingOutbox: 0,
    });
  });
});
