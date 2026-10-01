import type { Logger } from '../logger.js';
import {
  createShutdownSignal,
  type ShutdownSignal,
} from './shutdown-signal.js';

const silentLogger: Logger = {
  info: vi.fn(),
  warn: () => undefined,
  error: () => undefined,
};

describe('createShutdownSignal', () => {
  it('listens for SIGINT and SIGTERM', () => {
    const subscribed: ShutdownSignal[] = [];

    createShutdownSignal(silentLogger, (signal) => {
      subscribed.push(signal);
    });

    expect(subscribed).toEqual(['SIGINT', 'SIGTERM']);
  });

  it('logs and aborts on either signal', () => {
    const handlers = new Map<ShutdownSignal, () => void>();
    const signal = createShutdownSignal(silentLogger, (name, handler) => {
      handlers.set(name, handler);
    });

    handlers.get('SIGINT')?.();
    expect(signal.aborted).toBe(true);
    expect(silentLogger.info).toHaveBeenCalledWith('Shutting down', {
      signal: 'SIGINT',
    });

    handlers.get('SIGTERM')?.();
    expect(silentLogger.info).toHaveBeenCalledWith('Shutting down', {
      signal: 'SIGTERM',
    });
  });
});
