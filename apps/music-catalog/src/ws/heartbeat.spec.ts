import { EventEmitter } from 'node:events';
import { type HeartbeatSocket, startHeartbeat } from './heartbeat.js';

class FakeSocket extends EventEmitter implements HeartbeatSocket {
  readonly ping = vi.fn();
  readonly terminate = vi.fn();
}

const INTERVAL = 1000;

const setup = (sockets: FakeSocket[]) => {
  const heartbeat = startHeartbeat({
    intervalMs: INTERVAL,
    sockets: () => sockets,
  });
  return heartbeat;
};

describe('startHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pings a tracked socket every interval', () => {
    const socket = new FakeSocket();
    const heartbeat = setup([socket]);
    heartbeat.track(socket);

    vi.advanceTimersByTime(INTERVAL);

    expect(socket.ping).toHaveBeenCalledTimes(1);
    expect(socket.terminate).not.toHaveBeenCalled();
  });

  it('keeps a socket that answers every ping with a pong', () => {
    const socket = new FakeSocket();
    const heartbeat = setup([socket]);
    heartbeat.track(socket);

    for (let round = 0; round < 5; round++) {
      vi.advanceTimersByTime(INTERVAL);
      socket.emit('pong');
    }

    expect(socket.ping).toHaveBeenCalledTimes(5);
    expect(socket.terminate).not.toHaveBeenCalled();
  });

  it('terminates a socket that missed the pong for one whole interval', () => {
    const socket = new FakeSocket();
    const heartbeat = setup([socket]);
    heartbeat.track(socket);

    vi.advanceTimersByTime(INTERVAL);
    expect(socket.terminate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(INTERVAL);

    expect(socket.terminate).toHaveBeenCalledTimes(1);
    expect(socket.ping).toHaveBeenCalledTimes(1);
  });

  it('accepts a pong that arrives late in the interval', () => {
    const socket = new FakeSocket();
    const heartbeat = setup([socket]);
    heartbeat.track(socket);

    vi.advanceTimersByTime(INTERVAL);
    vi.advanceTimersByTime(INTERVAL - 1);
    socket.emit('pong');
    vi.advanceTimersByTime(1);

    expect(socket.terminate).not.toHaveBeenCalled();
  });

  it('only terminates the dead socket, not the healthy ones', () => {
    const healthy = new FakeSocket();
    const dead = new FakeSocket();
    const heartbeat = setup([healthy, dead]);
    heartbeat.track(healthy);
    heartbeat.track(dead);

    vi.advanceTimersByTime(INTERVAL);
    healthy.emit('pong');
    vi.advanceTimersByTime(INTERVAL);

    expect(dead.terminate).toHaveBeenCalledTimes(1);
    expect(healthy.terminate).not.toHaveBeenCalled();
    expect(healthy.ping).toHaveBeenCalledTimes(2);
  });

  it('does nothing until an interval has passed', () => {
    const socket = new FakeSocket();
    const heartbeat = setup([socket]);
    heartbeat.track(socket);

    vi.advanceTimersByTime(INTERVAL - 1);

    expect(socket.ping).not.toHaveBeenCalled();
  });

  it('stops pinging after stop()', () => {
    const socket = new FakeSocket();
    const heartbeat = setup([socket]);
    heartbeat.track(socket);

    heartbeat.stop();
    vi.advanceTimersByTime(INTERVAL * 3);

    expect(socket.ping).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
