import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  type MusicCatalogSearchParams,
  type MusicCatalogSearchResult,
  musicCatalogSearchResponseSchema,
} from '@notefinder/contracts';
import WebSocket from 'ws';
import { AppException } from '../../common/errors/app-exception.js';
import { ENV, type Env } from '../../config/env.js';

// First reconnect waits this long, then doubles up to the maximum below.
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10_000;

/** How long one catalog search may take when the env leaves it unset. */
const MUSIC_CATALOG_DEFAULT_TIMEOUT_MS = 5_000;

type PendingSearch = {
  resolve: (result: MusicCatalogSearchResult) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

/**
 * Single persistent WebSocket to the private Music catalog service. The API
 * dials once at boot with key auth and multiplexes many simultaneous
 * searches over it, matched by request id (responses may arrive out of
 * order). A dropped connection is redialed with exponential backoff; the
 * requests in flight then fail so callers can retry.
 *
 * Heartbeat needs no code: the `ws` client answers the server's pings by
 * itself, and a dead peer surfaces as a close, which redials.
 */
@Injectable()
export class MusicCatalogClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MusicCatalogClient.name);
  private socket: WebSocket | undefined;
  private connecting: Promise<void> | undefined;
  private readonly pending = new Map<string, PendingSearch>();
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private stopped = false;

  constructor(@Inject(ENV) private readonly env: Env) {}

  onModuleInit(): void {
    if (!this.isConfigured()) {
      if (this.env.NODE_ENV === 'production') {
        throw new Error(
          'Invalid environment variables:\nMUSIC_CATALOG_URL: Required in production',
        );
      }
      this.logger.warn(
        'Music catalog not configured: search fails until ' +
          'MUSIC_CATALOG_URL and MUSIC_CATALOG_API_KEY are set',
      );
      return;
    }
    this.dialInBackground();
  }

  onModuleDestroy(): void {
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
   * Searches the catalog, keeping the catalog's relevance order. Every hit
   * is returned untouched; the caller adds the Track link.
   */
  async search(
    params: MusicCatalogSearchParams,
  ): Promise<MusicCatalogSearchResult> {
    if (!this.isConfigured()) {
      throw new AppException(
        'INTERNAL_ERROR',
        'Music catalog is not configured',
      );
    }
    try {
      await this.ensureConnected();
    } catch (error: unknown) {
      this.logger.warn(
        `Music catalog dial failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new AppException(
        'INTERNAL_ERROR',
        'Music catalog is not connected',
      );
    }
    const socket = this.socket;
    if (socket === undefined || socket.readyState !== WebSocket.OPEN) {
      throw new AppException(
        'INTERNAL_ERROR',
        'Music catalog is not connected',
      );
    }
    const id = randomUUID();
    const timeoutMs =
      this.env.MUSIC_CATALOG_REQUEST_TIMEOUT_MS ??
      MUSIC_CATALOG_DEFAULT_TIMEOUT_MS;
    return new Promise<MusicCatalogSearchResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new AppException('INTERNAL_ERROR', 'Music catalog request timed out'),
        );
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id, type: 'search', payload: params }));
      } catch {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(
          new AppException('INTERNAL_ERROR', 'Music catalog is not connected'),
        );
      }
    });
  }

  private isConfigured(): boolean {
    return (
      this.env.MUSIC_CATALOG_URL !== undefined &&
      this.env.MUSIC_CATALOG_API_KEY !== undefined
    );
  }

  private dialInBackground(): void {
    this.ensureConnected().catch((error: unknown) => {
      this.logger.warn(
        `Music catalog initial dial failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.scheduleReconnect();
    });
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
    const response = musicCatalogSearchResponseSchema.safeParse(parsed);
    if (!response.success || response.data.id === null) {
      this.logger.warn('Dropping an unreadable frame from the Music catalog');
      return;
    }
    const pending = this.pending.get(response.data.id);
    if (pending === undefined) {
      return;
    }
    this.pending.delete(response.data.id);
    clearTimeout(pending.timer);
    if (response.data.ok) {
      pending.resolve(response.data.result);
      return;
    }
    pending.reject(
      new AppException('INTERNAL_ERROR', response.data.error.message),
    );
  }

  private handleClose(socket: WebSocket): void {
    if (this.socket !== socket) {
      return;
    }
    this.socket = undefined;
    this.failPending(
      new AppException('INTERNAL_ERROR', 'Music catalog disconnected'),
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
      clearTimeout(pending.timer);
      pending.reject(error);
    }
  }
}
