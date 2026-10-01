import type { Logger } from '../logger.js';

export type ShutdownSignal = 'SIGINT' | 'SIGTERM';

export type SubscribeSignal = (
  signal: ShutdownSignal,
  handler: () => void,
) => void;

/**
 * Aborts the returned signal on SIGINT/SIGTERM, so an entrypoint stops its
 * loop after the work in progress. Shared by the worker and the restore
 * (the server closes connections instead, so it wires its own shutdown).
 * `subscribe` is `process.once` in production and a fake in tests, so no
 * spec ever emits a real signal.
 */
export const createShutdownSignal = (
  logger: Logger,
  subscribe: SubscribeSignal = process.once.bind(process),
): AbortSignal => {
  const controller = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    subscribe(signal, () => {
      logger.info('Shutting down', { signal });
      controller.abort();
    });
  }
  return controller.signal;
};
