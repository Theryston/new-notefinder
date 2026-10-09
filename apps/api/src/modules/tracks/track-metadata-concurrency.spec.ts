import { mapWithConcurrency } from './track-metadata-concurrency.js';

// The import calls the Music catalog and downloads covers for many Albums at
// once: the helper keeps the results in order and never runs more than `limit`
// calls at a time.

/** A task that resolves after `ms`, recording how many run at once. */
const tracked =
  (ms: number, log: { active: number; peak: number }) =>
  async (value: number): Promise<number> => {
    log.active += 1;
    log.peak = Math.max(log.peak, log.active);
    await new Promise((resolve) => setTimeout(resolve, ms));
    log.active -= 1;
    return value * 10;
  };

describe('mapWithConcurrency', () => {
  it('answers the results in the order of the items, whatever order they finish in', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 3, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 4 - value));
      return value;
    });

    expect(results).toEqual([1, 2, 3]);
  });

  it('never runs more calls at once than the limit', async () => {
    const log = { active: 0, peak: 0 };

    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, tracked(5, log));

    expect(log.peak).toBe(2);
  });

  it('answers an empty list without calling the task', async () => {
    const task = vi.fn(async (value: number) => value);

    await expect(mapWithConcurrency([], 3, task)).resolves.toEqual([]);
    expect(task).not.toHaveBeenCalled();
  });

  it('rejects with the first failure and starts no further items after it', async () => {
    const started: number[] = [];
    const task = async (value: number): Promise<number> => {
      started.push(value);
      if (value === 2) {
        throw new Error('catalog is down');
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      return value;
    };

    await expect(mapWithConcurrency([1, 2, 3, 4], 1, task)).rejects.toThrow(
      'catalog is down',
    );
    expect(started).toEqual([1, 2]);
  });
});
