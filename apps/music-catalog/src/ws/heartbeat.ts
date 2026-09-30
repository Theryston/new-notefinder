import type { EventEmitter } from 'node:events';

/** The part of a `ws` WebSocket the heartbeat needs. */
export type HeartbeatSocket = Pick<EventEmitter, 'on'> & {
  ping: () => void;
  terminate: () => void;
};

export type HeartbeatOptions = {
  intervalMs: number;
  /** The connections to check, read at every tick. */
  sockets: () => Iterable<HeartbeatSocket>;
};

export type Heartbeat = {
  /** Starts watching a connection; call it when it opens. */
  track: (socket: HeartbeatSocket) => void;
  stop: () => void;
};

/**
 * Ping/pong liveness. At every tick a socket that answered the previous ping
 * is pinged again; one that did not is terminated, so a peer that vanished
 * without closing (crash, network cut) is dropped within two intervals.
 */
export const startHeartbeat = (options: HeartbeatOptions): Heartbeat => {
  const alive = new WeakSet<HeartbeatSocket>();

  const timer = setInterval(() => {
    for (const socket of options.sockets()) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, options.intervalMs);

  return {
    track: (socket) => {
      alive.add(socket);
      socket.on('pong', () => alive.add(socket));
    },
    stop: () => clearInterval(timer),
  };
};
