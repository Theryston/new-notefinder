import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { type RawData, WebSocket, WebSocketServer } from 'ws';
import type { Logger } from '../logger.js';
import { createApiKeyVerifier } from './api-keys.js';
import { createDispatcher } from './dispatcher.js';
import { errorResponse } from './envelope.js';
import type { Handler } from './handler.js';
import { buildUnauthorizedResponse } from './handshake.js';
import { startHeartbeat } from './heartbeat.js';

// Requests are small JSON envelopes; anything bigger is a bug or an attack,
// and ws closes the connection with 1009 (message too big) before buffering it.
const MAX_MESSAGE_BYTES = 64 * 1024;
// Close code 1001: the server is going away, so clients reconnect.
const CLOSE_GOING_AWAY = 1001;
// A client that ignores the close frame is cut off after this long.
const CLOSE_GRACE_MS = 5000;

export type WsServerOptions = {
  port: number;
  apiKeys: readonly string[];
  handlers: readonly Handler[];
  heartbeatIntervalMs: number;
  requestTimeoutMs: number;
  logger: Logger;
};

export type WsServer = {
  /** Starts listening; resolves with the port actually bound. */
  start: () => Promise<{ port: number }>;
  /** Closes every connection and stops listening. */
  stop: () => Promise<void>;
};

type Dispatch = ReturnType<typeof createDispatcher>;

const rawToText = (data: RawData): string => {
  const buffer = Array.isArray(data)
    ? Buffer.concat(data)
    : Buffer.from(data as Buffer);
  return buffer.toString('utf8');
};

// Plain HTTP is not part of the protocol: say so instead of hanging.
const refusePlainHttp = (
  _request: IncomingMessage,
  response: ServerResponse,
): void => {
  response.writeHead(426, { Upgrade: 'websocket', Connection: 'Upgrade' });
  response.end();
};

const refuseHandshake = (socket: Duplex): void => {
  socket.on('error', () => socket.destroy());
  socket.end(buildUnauthorizedResponse());
};

const answer = async (
  dispatch: Dispatch,
  socket: WebSocket,
  message: { data: RawData; isBinary: boolean },
): Promise<void> => {
  const response = message.isBinary
    ? errorResponse(
        null,
        'VALIDATION_FAILED',
        'Binary messages are not supported',
      )
    : await dispatch(rawToText(message.data));
  // The client may have left while its request was being answered.
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(response));
  }
};

const listen = (server: Server, port: number): Promise<{ port: number }> =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      resolve({ port: (server.address() as AddressInfo).port });
    });
  });

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections();
  });

/**
 * The WebSocket endpoint: authenticates the handshake, then answers each
 * text frame through the dispatcher. Every message is handled on its own, so
 * many requests can be in flight on one connection.
 */
export const createWsServer = (options: WsServerOptions): WsServer => {
  const { logger } = options;
  const isAuthorized = createApiKeyVerifier(options.apiKeys);
  const dispatch = createDispatcher(options);
  const httpServer = createServer(refusePlainHttp);
  // noServer: the upgrade is handled here, so the API key is checked before
  // any WebSocket exists.
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  const heartbeat = startHeartbeat({
    intervalMs: options.heartbeatIntervalMs,
    sockets: () => wss.clients,
  });

  httpServer.on('upgrade', (request, socket, head) => {
    if (!isAuthorized(request.headers.authorization)) {
      logger.warn('Handshake refused', {
        address: request.socket.remoteAddress,
      });
      refuseHandshake(socket);
      return;
    }
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit('connection', client, request);
    });
  });

  wss.on('connection', (socket: WebSocket) => {
    heartbeat.track(socket);
    logger.info('Client connected', { clients: wss.clients.size });
    socket.on('message', (data, isBinary) => {
      answer(dispatch, socket, { data, isBinary }).catch((error: unknown) => {
        logger.error('Could not answer a message', { error });
      });
    });
    socket.on('error', (error) => {
      logger.warn('WebSocket error', { error });
    });
    socket.on('close', (code) => {
      logger.info('Client disconnected', { code, clients: wss.clients.size });
    });
  });

  const stop = async (): Promise<void> => {
    heartbeat.stop();
    for (const client of wss.clients) {
      client.close(CLOSE_GOING_AWAY, 'Server shutting down');
    }
    const forceClose = setTimeout(() => {
      for (const client of wss.clients) {
        client.terminate();
      }
    }, CLOSE_GRACE_MS);
    try {
      await closeServer(httpServer);
    } finally {
      clearTimeout(forceClose);
    }
  };

  return { start: () => listen(httpServer, options.port), stop };
};
