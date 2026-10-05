import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startWorkerHeartbeat } from './worker-heartbeat.js';

const INTERVAL = 1000;

const setup = (touch: (path: string) => Promise<void>) => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const heartbeat = startWorkerHeartbeat({
    path: '/run/heartbeat',
    intervalMs: INTERVAL,
    logger,
    touch,
  });
  return { logger, heartbeat };
};

describe('startWorkerHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('touches the file right away, then once per interval', async () => {
    const touch = vi.fn(async () => undefined);
    const { heartbeat } = setup(touch);

    await vi.advanceTimersByTimeAsync(0);
    expect(touch).toHaveBeenCalledExactlyOnceWith('/run/heartbeat');
    await vi.advanceTimersByTimeAsync(INTERVAL - 1);
    expect(touch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(touch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(touch).toHaveBeenCalledTimes(5);

    heartbeat.stop();
  });

  it('stops touching once stopped, with no timer left', async () => {
    const touch = vi.fn(async () => undefined);
    const { heartbeat } = setup(touch);
    await vi.advanceTimersByTimeAsync(0);

    heartbeat.stop();

    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(INTERVAL * 5);
    expect(touch).toHaveBeenCalledTimes(1);
  });

  it('does not keep the process alive on its own', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const { heartbeat } = setup(vi.fn(async () => undefined));

    const timer = setIntervalSpy.mock.results[0]?.value as NodeJS.Timeout;
    expect(timer.hasRef()).toBe(false);

    heartbeat.stop();
    setIntervalSpy.mockRestore();
  });

  it('warns once per failing streak, keeps trying and says when it recovers', async () => {
    const failure = new Error('read-only file system');
    // Five touches: fail, fail, write, fail, write.
    const touch = vi
      .fn<(path: string) => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(undefined);
    const { logger, heartbeat } = setup(touch);

    await vi.advanceTimersByTimeAsync(INTERVAL * 4);

    expect(touch).toHaveBeenCalledTimes(5);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not write the worker heartbeat file',
      { path: '/run/heartbeat', error: failure },
    );
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      'The worker heartbeat file is written again',
      { path: '/run/heartbeat' },
    );
    heartbeat.stop();
  });

  it('stays quiet while every write works', async () => {
    const { logger, heartbeat } = setup(vi.fn(async () => undefined));

    await vi.advanceTimersByTimeAsync(INTERVAL * 3);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    heartbeat.stop();
  });
});

describe('startWorkerHeartbeat with the real file system', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'worker-heartbeat-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const waitFor = async (check: () => Promise<boolean>): Promise<void> => {
    const deadline = Date.now() + 3000;
    while (!(await check())) {
      if (Date.now() > deadline) {
        throw new Error('Timed out waiting for the heartbeat file');
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  it('creates the file and keeps its modification time fresh', async () => {
    const path = join(dir, 'heartbeat');
    const heartbeat = startWorkerHeartbeat({
      path,
      intervalMs: 20,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    try {
      await waitFor(() =>
        stat(path).then(
          () => true,
          () => false,
        ),
      );
      const first = (await stat(path)).mtimeMs;
      await waitFor(async () => (await stat(path)).mtimeMs > first);
      expect(await readFile(path, 'utf8')).toMatch(
        /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\n$/,
      );
    } finally {
      heartbeat.stop();
    }
  });
});
