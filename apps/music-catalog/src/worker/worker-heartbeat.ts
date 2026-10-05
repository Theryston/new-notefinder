import { writeFile } from 'node:fs/promises';
import type { Logger } from '../logger.js';

export type WorkerHeartbeatOptions = {
  /** The file whose modification time is the signal the health check reads. */
  path: string;
  /** Time between two writes. */
  intervalMs: number;
  logger: Logger;
  /** Replaced in tests; the real one rewrites the file with the time. */
  touch?: (path: string) => Promise<void>;
};

export type WorkerHeartbeat = {
  /** Stops writing; the file stays where it is. */
  stop: () => void;
};

const writeTime = (path: string): Promise<void> =>
  writeFile(path, `${new Date().toISOString()}\n`);

/**
 * The worker's liveness signal: keeps a file's modification time fresh for
 * as long as the process's event loop turns, so a container health check can
 * tell a live worker from a wedged one (Compose cannot see inside it, and the
 * loop only logs a failing tick). It runs on its own timer instead of once
 * per tick on purpose: a tick legitimately lasts hours during the first
 * import (indexing tens of millions of Recordings, unpacking LRCLIB's dump),
 * and a heartbeat that waited for it would report that as unhealthy. It does
 * not prove a tick is making progress; failures of those are logged by the
 * loop. A write that fails never reaches the worker: it is logged once per
 * streak, and again when writes work.
 */
export const startWorkerHeartbeat = (
  options: WorkerHeartbeatOptions,
): WorkerHeartbeat => {
  const { path, intervalMs, logger, touch = writeTime } = options;
  let failing = false;
  const beat = (): void => {
    touch(path).then(
      () => {
        if (failing) {
          failing = false;
          logger.info('The worker heartbeat file is written again', { path });
        }
      },
      (error: unknown) => {
        if (!failing) {
          failing = true;
          logger.warn('Could not write the worker heartbeat file', {
            path,
            error,
          });
        }
      },
    );
  };
  beat();
  // The signal is only worth something while the worker runs: it must never
  // be what keeps the process from exiting.
  const timer = setInterval(beat, intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer) };
};
