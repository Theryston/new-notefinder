/** Runs one task under a limiter, answering the task's own result or failure. */
export type Limiter = <TResult>(
  task: () => Promise<TResult>,
) => Promise<TResult>;

/**
 * A limiter that keeps at most `limit` tasks in flight. Tasks wait their turn in
 * the order they were submitted; a failed task rejects only itself, and frees
 * its slot for the next one. An import creates one limiter per job, so the
 * catalog calls of one job are bounded however many Albums and Artists it has.
 */
export const createLimiter = (limit: number): Limiter => {
  let active = 0;
  const waiting: (() => void)[] = [];

  const acquire = (): Promise<void> => {
    if (active < limit) {
      active += 1;
      return Promise.resolve();
    }
    // The slot is handed over with the wake-up, so `active` never exceeds limit.
    return new Promise((resolve) => {
      waiting.push(() => {
        active += 1;
        resolve();
      });
    });
  };

  const release = (): void => {
    active -= 1;
    waiting.shift()?.();
  };

  return async (task) => {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };
};
