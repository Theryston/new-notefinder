import type { Logger } from '../logger.js';

export type WorkerLoopOptions = {
  /** One round of periodic work. A throw is logged and the loop carries on. */
  tick: () => Promise<void>;
  /** Time between the end of a tick and the start of the next one. */
  intervalMs: number;
  /** Aborting it ends the loop once the tick in progress has finished. */
  signal: AbortSignal;
  logger: Logger;
};

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const wake = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', wake);
      resolve();
    };
    const timer = setTimeout(wake, ms);
    signal.addEventListener('abort', wake);
  });

/**
 * The worker's heartbeat: run the tick, wait, repeat until aborted. Ticks
 * never overlap, so the work a tick does needs no lock against itself, and a
 * shutdown never interrupts one halfway.
 */
export const runWorkerLoop = async (
  options: WorkerLoopOptions,
): Promise<void> => {
  while (!options.signal.aborted) {
    try {
      await options.tick();
    } catch (error) {
      options.logger.error('Worker tick failed', { error });
    }
    await sleep(options.intervalMs, options.signal);
  }
};
