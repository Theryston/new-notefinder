import { Worker } from 'bullmq';
import { AppWorker } from './app-worker.js';

describe('AppWorker.close', () => {
  const closeSpy = vi.spyOn(Worker.prototype, 'close');

  beforeEach(() => {
    closeSpy.mockReset().mockResolvedValue(undefined);
  });

  afterAll(() => {
    closeSpy.mockRestore();
  });

  // Calls the override on a stand-in, so no real Redis connection is opened.
  const closeWith = (status: string, force?: boolean) =>
    AppWorker.prototype.close.call(
      { backend: { connection: { status } } } as unknown as AppWorker,
      force,
    );

  it('closes gracefully when Redis is connected', async () => {
    await closeWith('ready');
    expect(closeSpy).toHaveBeenCalledWith(false);
  });

  it('forces the close when Redis never connected (would hang forever)', async () => {
    await closeWith('initializing');
    expect(closeSpy).toHaveBeenCalledWith(true);
  });

  it('keeps an explicit force', async () => {
    await closeWith('ready', true);
    expect(closeSpy).toHaveBeenCalledWith(true);
  });
});
