import type { BootstrapPhase } from '@notefinder/contracts';
import type { Logger } from '../../logger.js';
import { SearchReadiness } from './search-readiness.js';

const setup = (readPhase: () => Promise<BootstrapPhase>) => {
  const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
  const readiness = new SearchReadiness({
    readPhase,
    refreshIntervalMs: 5000,
    logger: logger as unknown as Logger,
  });
  return { readiness, logger };
};

describe('SearchReadiness', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('loads persisted state before starting its refresh timer', async () => {
    const readPhase = vi.fn(async () => 'indexing' as const);
    const { readiness } = setup(readPhase);

    await readiness.start();

    expect(readPhase).toHaveBeenCalledTimes(1);
    expect(() => readiness.assertReady()).toThrow(
      expect.objectContaining({ code: 'CATALOG_NOT_READY' }),
    );
    expect(readPhase).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    await readiness.stop();
  });

  it('adopts ready state within the five-second refresh interval', async () => {
    let phase: BootstrapPhase = 'indexing';
    const { readiness } = setup(async () => phase);
    await readiness.start();

    phase = 'ready';
    await vi.advanceTimersByTimeAsync(5000);

    expect(() => readiness.assertReady()).not.toThrow();
    await readiness.stop();
  });

  it('does not overlap refreshes when a database read takes longer than the interval', async () => {
    let resolveRefresh: ((phase: BootstrapPhase) => void) | undefined;
    const readPhase = vi
      .fn<() => Promise<BootstrapPhase>>()
      .mockResolvedValueOnce('indexing')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      )
      .mockResolvedValue('ready');
    const { readiness } = setup(readPhase);
    await readiness.start();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(readPhase).toHaveBeenCalledTimes(2);

    resolveRefresh?.('ready');
    await vi.advanceTimersByTimeAsync(5000);
    expect(readPhase).toHaveBeenCalledTimes(3);
    expect(() => readiness.assertReady()).not.toThrow();
    await readiness.stop();
  });

  it('keeps the last known phase after a refresh failure and retries later', async () => {
    const readPhase = vi
      .fn<() => Promise<BootstrapPhase>>()
      .mockResolvedValueOnce('indexing')
      .mockRejectedValueOnce(new Error('database offline'))
      .mockResolvedValueOnce('ready');
    const { readiness, logger } = setup(readPhase);
    await readiness.start();

    await vi.advanceTimersByTimeAsync(5000);
    expect(() => readiness.assertReady()).toThrow(
      expect.objectContaining({ code: 'CATALOG_NOT_READY' }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Search readiness refresh failed',
      { error: expect.any(Error) },
    );

    await vi.advanceTimersByTimeAsync(5000);
    expect(() => readiness.assertReady()).not.toThrow();
    await readiness.stop();
  });

  it('keeps an already-ready serving catalog searchable through cutover indexing', async () => {
    let phase: BootstrapPhase = 'ready';
    const readPhase = vi.fn(async () => phase);
    const { readiness } = setup(readPhase);
    await readiness.start();

    phase = 'indexing';
    await vi.advanceTimersByTimeAsync(5000);

    expect(readPhase).toHaveBeenCalledTimes(2);
    expect(() => readiness.assertReady()).not.toThrow();
    await readiness.stop();
  });

  it('fails startup when the initial persisted readiness read fails', async () => {
    const { readiness } = setup(async () => {
      throw new Error('database offline');
    });

    await expect(readiness.start()).rejects.toThrow('database offline');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops its timer cleanly', async () => {
    const readPhase = vi.fn(async () => 'ready' as const);
    const { readiness } = setup(readPhase);
    await readiness.start();

    await readiness.stop();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(readPhase).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not wait for a stalled refresh or adopt its late result after stop', async () => {
    let resolveRefresh: ((phase: BootstrapPhase) => void) | undefined;
    const readPhase = vi
      .fn<() => Promise<BootstrapPhase>>()
      .mockResolvedValueOnce('indexing')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );
    const { readiness } = setup(readPhase);
    await readiness.start();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(readiness.stop()).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);

    resolveRefresh?.('ready');
    await Promise.resolve();
    expect(readiness.currentPhase).toBe('indexing');
  });
});
