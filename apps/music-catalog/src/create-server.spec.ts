import type { BootstrapPhase } from '@notefinder/contracts';
import { withSearchReadiness } from './create-server.js';
import type { Logger } from './logger.js';
import { SearchReadiness } from './modules/search/search-readiness.js';
import { createWsServer, type WsServer } from './ws/ws-server.js';

const logger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as unknown as Logger;

const createReadiness = (readPhase: () => Promise<BootstrapPhase>) =>
  new SearchReadiness({
    readPhase,
    refreshIntervalMs: 5000,
    logger,
  });

const createServerWithHeartbeat = (start: () => Promise<{ port: number }>) => {
  const heartbeat = setInterval(() => undefined, 60_000);
  const server: WsServer = {
    start,
    stop: vi.fn(async () => clearInterval(heartbeat)),
  };
  return { server, heartbeat };
};

describe('withSearchReadiness', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stops the server heartbeat when its initial readiness read fails', async () => {
    const failure = new Error('database offline');
    const readiness = createReadiness(async () => {
      throw failure;
    });
    const server = createWsServer({
      port: 0,
      apiKeys: [],
      handlers: [],
      heartbeatIntervalMs: 60_000,
      requestTimeoutMs: 1000,
      logger,
    });
    const wrapped = withSearchReadiness(server, readiness);

    await expect(wrapped.start()).rejects.toBe(failure);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops readiness and the server heartbeat when listening fails', async () => {
    const failure = new Error('port unavailable');
    const readiness = createReadiness(async () => 'ready');
    const { server } = createServerWithHeartbeat(async () => {
      throw failure;
    });
    const wrapped = withSearchReadiness(server, readiness);

    await expect(wrapped.start()).rejects.toBe(failure);

    expect(server.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    await wrapped.stop();
  });
});
