import { createLimiter } from './track-metadata-limiter.js';

// One limiter per import bounds the catalog calls and cover downloads of a job:
// at most `limit` run at once, a failure frees its slot, and each waits its turn.

/** A task that holds for `ms`, recording how many run at once. */
const tracked =
  (ms: number, log: { active: number; peak: number }) =>
  async (): Promise<void> => {
    log.active += 1;
    log.peak = Math.max(log.peak, log.active);
    await new Promise((resolve) => setTimeout(resolve, ms));
    log.active -= 1;
  };

describe('createLimiter', () => {
  it('never runs more tasks at once than its limit, and uses the whole limit', async () => {
    const limit = createLimiter(3);
    const log = { active: 0, peak: 0 };

    await Promise.all(Array.from({ length: 10 }, () => limit(tracked(5, log))));

    expect(log.peak).toBe(3);
  });

  it('answers each task its own result', async () => {
    const limit = createLimiter(2);

    const results = await Promise.all(
      [1, 2, 3, 4].map((value) =>
        limit(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5 - value));
          return value * 10;
        }),
      ),
    );

    expect(results).toEqual([10, 20, 30, 40]);
  });

  it('rejects only the task that failed, and keeps serving the rest', async () => {
    const limit = createLimiter(1);

    const failing = limit(async () => {
      throw new Error('catalog is down');
    });
    const following = limit(async () => 'still served');

    await expect(failing).rejects.toThrow('catalog is down');
    await expect(following).resolves.toBe('still served');
  });

  it('frees a slot when its task fails, so waiting tasks are not held back', async () => {
    const limit = createLimiter(2);
    const log = { active: 0, peak: 0 };

    const tasks = [
      limit(async () => {
        throw new Error('one of them fails');
      }),
      ...Array.from({ length: 5 }, () => limit(tracked(2, log))),
    ];

    await expect(Promise.allSettled(tasks)).resolves.toHaveLength(6);
    expect(log.peak).toBe(2);
  });
});
