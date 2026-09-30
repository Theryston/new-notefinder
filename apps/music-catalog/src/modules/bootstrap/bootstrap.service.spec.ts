import type { BootstrapRepository } from './bootstrap.repository.js';
import { BootstrapService } from './bootstrap.service.js';

const setup = (state: Awaited<ReturnType<BootstrapRepository['getState']>>) => {
  const repository = { getState: vi.fn(async () => state) };
  const service = new BootstrapService(
    repository as unknown as BootstrapRepository,
    'sample',
  );
  return { service, repository };
};

describe('BootstrapService', () => {
  describe('getStatus', () => {
    it.each([
      ['restoring', 'sample'],
      ['restored', 'sample'],
      ['indexing', 'full'],
      ['ready', 'full'],
    ] as const)(
      'reports the recorded phase %s and dataset %s',
      async (phase, dataset) => {
        const { service } = setup({ phase, dataset });

        await expect(service.getStatus()).resolves.toEqual({ phase, dataset });
      },
    );

    it('reports the recorded dataset, not the configured one', async () => {
      const { service } = setup({ phase: 'indexing', dataset: 'full' });

      await expect(service.getStatus()).resolves.toHaveProperty(
        'dataset',
        'full',
      );
    });

    it('is still restoring the configured dataset before the import records anything', async () => {
      const { service } = setup(undefined);

      await expect(service.getStatus()).resolves.toEqual({
        phase: 'restoring',
        dataset: 'sample',
      });
    });

    it('reads the state on every call, so it follows the worker', async () => {
      const { service, repository } = setup({
        phase: 'restoring',
        dataset: 'sample',
      });

      await service.getStatus();
      repository.getState.mockResolvedValueOnce({
        phase: 'ready',
        dataset: 'sample',
      });

      await expect(service.getStatus()).resolves.toMatchObject({
        phase: 'ready',
      });
      expect(repository.getState).toHaveBeenCalledTimes(2);
    });
  });
});

describe('BootstrapService assertReady', () => {
  it('lets a request through once the import is ready', async () => {
    const { service } = setup({ phase: 'ready', dataset: 'full' });

    await expect(service.assertReady()).resolves.toBeUndefined();
  });

  it.each([['restoring'], ['restored'], ['indexing']] as const)(
    'answers CATALOG_NOT_READY in the %s phase, naming it',
    async (phase) => {
      const { service } = setup({ phase, dataset: 'full' });

      await expect(service.assertReady()).rejects.toMatchObject({
        code: 'CATALOG_NOT_READY',
        message: expect.stringContaining(phase),
      });
    },
  );

  it('answers CATALOG_NOT_READY before the import records anything', async () => {
    const { service } = setup(undefined);

    await expect(service.assertReady()).rejects.toMatchObject({
      code: 'CATALOG_NOT_READY',
    });
  });

  it('reads the state on every call, so it follows the worker', async () => {
    const { service, repository } = setup({
      phase: 'indexing',
      dataset: 'full',
    });
    await expect(service.assertReady()).rejects.toBeDefined();
    repository.getState.mockResolvedValueOnce({
      phase: 'ready',
      dataset: 'full',
    });

    await expect(service.assertReady()).resolves.toBeUndefined();
  });
});
