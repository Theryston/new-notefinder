import type { BootstrapRepository } from './bootstrap.repository.js';
import { BootstrapService } from './bootstrap.service.js';

const setup = () => {
  const repository = { advance: vi.fn(async () => undefined) };
  const service = new BootstrapService(
    repository as unknown as BootstrapRepository,
    'tiny',
  );
  return { service, repository };
};

describe('BootstrapService: the phases the worker records', () => {
  it('moves from restored to indexing when the worker starts indexing', async () => {
    const { service, repository } = setup();

    await service.startIndexing();

    expect(repository.advance).toHaveBeenCalledExactlyOnceWith({
      from: 'restored',
      to: 'indexing',
    });
  });

  it('moves from indexing to ready when every Recording is indexed', async () => {
    const { service, repository } = setup();

    await service.markReady();

    expect(repository.advance).toHaveBeenCalledExactlyOnceWith({
      from: 'indexing',
      to: 'ready',
    });
  });
});
