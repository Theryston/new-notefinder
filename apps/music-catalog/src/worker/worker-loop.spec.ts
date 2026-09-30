import { getEventListeners } from 'node:events';
import { runWorkerLoop } from './worker-loop.js';

const INTERVAL = 1000;

const setup = (tick: () => Promise<void>) => {
  const controller = new AbortController();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const done = runWorkerLoop({
    tick,
    intervalMs: INTERVAL,
    signal: controller.signal,
    logger,
  });
  return { controller, logger, done };
};

describe('runWorkerLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs a tick right away, then one per interval', async () => {
    const tick = vi.fn(async () => undefined);
    const { controller, done } = setup(tick);

    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVAL - 1);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(tick).toHaveBeenCalledTimes(5);

    controller.abort();
    await done;
  });

  it('stops promptly when aborted while waiting, with no timer left', async () => {
    const tick = vi.fn(async () => undefined);
    const { controller, done } = setup(tick);
    await vi.advanceTimersByTimeAsync(0);

    controller.abort();
    await done;

    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(INTERVAL * 5);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('does not pile up abort listeners as it keeps running', async () => {
    const { controller, done } = setup(async () => undefined);

    await vi.advanceTimersByTimeAsync(INTERVAL * 10);

    expect(getEventListeners(controller.signal, 'abort').length).toBeLessThan(
      2,
    );
    controller.abort();
    await done;
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  });

  it('does not tick at all when it starts already aborted', async () => {
    const tick = vi.fn(async () => undefined);
    const controller = new AbortController();
    controller.abort();

    await runWorkerLoop({
      tick,
      intervalMs: INTERVAL,
      signal: controller.signal,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(tick).not.toHaveBeenCalled();
  });

  it('finishes the tick in progress before stopping', async () => {
    let finishTick: () => void = () => undefined;
    const tick = vi.fn(
      () => new Promise<void>((resolve) => (finishTick = resolve)),
    );
    const { controller, done } = setup(tick);
    await vi.advanceTimersByTimeAsync(0);
    let stopped = false;
    void done.then(() => {
      stopped = true;
    });

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);
    finishTick();
    await done;

    expect(stopped).toBe(true);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('logs a failing tick and keeps going', async () => {
    const failure = new Error('disk full');
    const tick = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(undefined);
    const { controller, logger, done } = setup(tick);

    await vi.advanceTimersByTimeAsync(INTERVAL);

    expect(logger.error).toHaveBeenCalledExactlyOnceWith('Worker tick failed', {
      error: failure,
    });
    expect(tick).toHaveBeenCalledTimes(2);
    controller.abort();
    await done;
  });
});
