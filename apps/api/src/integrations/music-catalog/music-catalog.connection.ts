import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import WebSocket from 'ws';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception.js';
import type { Env } from '../../config/env.js';

// First reconnect waits this long, then doubles up to the maximum below.
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10_000;

/** How long one catalog request may take when the env leaves it unset. */
const MUSIC_CATALOG_DEFAULT_TIMEOUT_MS = 5_000;

type PendingRequest = {
  /** Settles the request when `frame` reads as its response; false otherwise. */
  answer: (frame: unknown) => boolean;
  fail: (error: Error) => void;
};

/**
 * The single persistent WebSocket to the private Music catalog service. It
 * dials once at boot with key auth and multiplexes many simultaneous
 * requests over it, matched by request id (responses may arrive out of
 * order). A dropped connection is redialed with exponential backoff; the
 * requests in flight then fail so callers can retry. `MusicCatalogClient`
 * builds the typed operations on top of {@link request}.
 *
 * Heartbeat needs no code: the `ws` client answers the server's pings by
 * itself, and a dead peer surfaces as a close, which redials.
 */
export class MusicCatalogConnection {
  private readonly logger = new Logger('MusicCatalogClient');
  private socket: WebSocket | undefined;
  private connecting: Promise<void> | undefined;
  private readonly pending = new Map<string, PendingRequest>();
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private stopped = false;

  constructor(private readonly env: Env) {}

  /** Dials in the background; a failed dial is retried with backoff. */
  start(): void {
    this.ensureConnected().catch((error: unknown) => {
      this.logger.warn(
        `Music catalog initial dial failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.scheduleReconnect();
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.socket?.close();
    this.socket = undefined;
    this.failPending(
      new AppException('INTERNAL_ERROR', 'Music catalog is shutting down'),
    );
  }

  /**
   * Sends one request and resolves with its response, parsed by
   * `responseSchema`. A response that does not read as one is dropped, so the
   * request keeps waiting for the right one until it times out. A dead catalog
   * surfaces as `SERVICE_UNAVAILABLE` (retryable) and a slow one as
   * `GATEWAY_TIMEOUT`.
   */
  async request<TOutput>(
    type: string,
    payload: unknown,
    responseSchema: z.ZodType<TOutput>,
  ): Promise<TOutput> {
    const socket = await this.openSocket();
    const id = randomUUID();
    return new Promise<TOutput>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new AppException(
            'GATEWAY_TIMEOUT',
            'Music catalog request timed out',
          ),
        );
      }, this.requestTimeoutMs());
      const settle = (): void => {
        this.pending.delete(id);
        clearTimeout(timer);
      };
      this.pending.set(id, {
        answer: (frame) => {
          const response = responseSchema.safeParse(frame);
          if (!response.success) {
            return false;
          }
          settle();
          resolve(response.data);
          return true;
        },
        fail: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      try {
        socket.send(JSON.stringify({ id, type, payload }));
      } catch {
        settle();
        reject(notConnected());
      }
    });
  }

  /** The open socket, dialing first when it is closed. */
  private async openSocket(): Promise<WebSocket> {
    try {
      await this.ensureConnected();
    } catch (error: unknown) {
      this.logger.warn(
        `Music catalog dial failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw notConnected();
    }
    const socket = this.socket;
    if (socket === undefined || socket.readyState !== WebSocket.OPEN) {
      throw notConnected();
    }
    return socket;
  }

  private requestTimeoutMs(): number {
    return (
      this.env.MUSIC_CATALOG_REQUEST_TIMEOUT_MS ??
      MUSIC_CATALOG_DEFAULT_TIMEOUT_MS
    );
  }

  private ensureConnected(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    this.connecting ??= this.dialOnce().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private async dialOnce(): Promise<void> {
    const url = this.env.MUSIC_CATALOG_URL;
    const key = this.env.MUSIC_CATALOG_API_KEY;
    if (url === undefined || key === undefined) {
      throw new AppException(
        'INTERNAL_ERROR',
        'Music catalog is not configured',
      );
    }
    const socket = new WebSocket(url, {
      headers: { Authorization: `Bearer ${key}` },
    });
    await new Promise<void>((resolve, reject) => {
      const onOpen = (): void => {
        socket.off('error', onError);
        socket.off('close', onClose);
        resolve();
      };
      const onError = (error: Error): void => {
        socket.off('open', onOpen);
        socket.off('close', onClose);
        reject(error);
      };
      const onClose = (): void => {
        socket.off('open', onOpen);
        socket.off('error', onError);
        reject(new Error('Connection closed'));
      };
      socket.once('open', onOpen);
      socket.once('error', onError);
      socket.once('close', onClose);
    });
    if (this.stopped) {
      socket.close();
      throw new AppException(
        'INTERNAL_ERROR',
        'Music catalog is shutting down',
      );
    }
    this.attachSocket(socket);
    this.socket = socket;
    this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    this.logger.log('Connected to the Music catalog');
  }

  private attachSocket(socket: WebSocket): void {
    socket.on('message', (data, isBinary) => {
      if (isBinary === true) {
        this.logger.warn('Dropping a binary frame from the Music catalog');
        return;
      }
      this.handleMessage(String(data));
    });
    socket.on('close', () => this.handleClose(socket));
    socket.on('error', (error: Error) => {
      this.logger.warn(`Music catalog socket error: ${error.message}`);
    });
  }

  private handleMessage(text: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.logger.warn('Dropping a non-JSON frame from the Music catalog');
      return;
    }
    const id = requestIdOf(parsed);
    if (id === undefined) {
      this.logger.warn('Dropping an unreadable frame from the Music catalog');
      return;
    }
    const pending = this.pending.get(id);
    if (pending === undefined) {
      return;
    }
    if (!pending.answer(parsed)) {
      this.logger.warn('Dropping an unreadable frame from the Music catalog');
    }
  }

  private handleClose(socket: WebSocket): void {
    if (this.socket !== socket) {
      return;
    }
    this.socket = undefined;
    this.failPending(
      new AppException('SERVICE_UNAVAILABLE', 'Music catalog disconnected'),
    );
    if (this.stopped) {
      return;
    }
    this.logger.warn('Lost the Music catalog connection, redialing');
    this.scheduleReconnect();
  }

  /**
   * Redials with exponential backoff until it succeeds or the module stops:
   * every failed attempt schedules the next one, so a sustained outage never
   * stalls the client.
   */
  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== undefined) {
      return;
    }
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.stopped) {
        return;
      }
      this.ensureConnected().catch((error: unknown) => {
        this.logger.warn(
          `Music catalog redial failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        this.scheduleReconnect();
      });
    }, delay);
  }

  private failPending(error: Error): void {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      pending.fail(error);
    }
  }
}

/** The error of a request sent while the catalog is out of reach. */
const notConnected = (): AppException =>
  new AppException('SERVICE_UNAVAILABLE', 'Music catalog is not connected');

/** The request id a frame carries, or undefined when it has none. */
function requestIdOf(frame: unknown): string | undefined {
  if (typeof frame !== 'object' || frame === null || !('id' in frame)) {
    return undefined;
  }
  return typeof frame.id === 'string' ? frame.id : undefined;
}
