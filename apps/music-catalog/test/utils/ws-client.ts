import { randomUUID } from 'node:crypto';
import WebSocket, { type ClientOptions, type RawData } from 'ws';

export type Handshake =
  | { opened: true; client: TestClient }
  | { opened: false; status: number; headers: Headers; body: string };

type Headers = Record<string, string | string[] | undefined>;

export type OpenOptions = {
  /** Sent as `Authorization: Bearer <key>`. Leave out to send no header. */
  key?: string;
  /** Sent as the whole `Authorization` header, instead of `key`. */
  authorization?: string;
  /** false: never answer the server's pings (a dead peer). */
  autoPong?: boolean;
};

const socketOptions = (options: OpenOptions): ClientOptions => {
  const authorization =
    options.authorization ??
    (options.key === undefined ? undefined : `Bearer ${options.key}`);
  return {
    headers:
      authorization === undefined ? {} : { Authorization: authorization },
    autoPong: options.autoPong ?? true,
  };
};

/**
 * A real `ws` client speaking the protocol, for the e2e specs. Responses are
 * matched to requests by `id`, exactly as a consumer of the service would.
 */
export class TestClient {
  readonly closed: Promise<{ code: number }>;
  private readonly received = new Map<string, unknown[]>();
  private readonly waiting = new Map<string, (message: unknown) => void>();

  constructor(private readonly socket: WebSocket) {
    socket.on('message', (data: RawData) => {
      this.deliver(JSON.parse(data.toString()));
    });
    this.closed = new Promise((resolve) => {
      socket.on('close', (code) => resolve({ code }));
    });
  }

  get isOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }

  /** Sends any value as a JSON text frame. */
  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }

  /** Sends a frame as is, to test messages no client should produce. */
  sendRaw(data: string | Buffer, options: { binary?: boolean } = {}): void {
    this.socket.send(data, { binary: options.binary ?? false });
  }

  /** Sends a request and resolves with the response that echoes its `id`. */
  request(
    type: string,
    payload?: unknown,
    id: string = randomUUID(),
  ): Promise<unknown> {
    const response = this.responseFor(id);
    this.send({ id, type, payload });
    return response;
  }

  /**
   * The next response for `id`; use `'null'` for the responses to messages
   * whose id could not be read.
   */
  responseFor(id: string): Promise<unknown> {
    const early = this.received.get(id)?.shift();
    if (early !== undefined) {
      return Promise.resolve(early);
    }
    return new Promise((resolve) => this.waiting.set(id, resolve));
  }

  close(): Promise<{ code: number }> {
    this.socket.close();
    return this.closed;
  }

  private deliver(message: unknown): void {
    const id = String((message as { id?: unknown }).id);
    const waiter = this.waiting.get(id);
    if (waiter === undefined) {
      this.received.set(id, [...(this.received.get(id) ?? []), message]);
      return;
    }
    this.waiting.delete(id);
    waiter(message);
  }
}

/**
 * Attempts the handshake and reports what happened: an open client, or the
 * HTTP answer that refused the upgrade.
 */
export const openClient = (
  url: string,
  options: OpenOptions = {},
): Promise<Handshake> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url, socketOptions(options));
    socket.once('open', () =>
      resolve({ opened: true, client: new TestClient(socket) }),
    );
    socket.once('unexpected-response', (_request, response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () =>
        resolve({
          opened: false,
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString(),
        }),
      );
    });
    socket.once('error', reject);
  });

/** Opens a connection that must be accepted. */
export const connect = async (
  url: string,
  key: string,
  options: Omit<OpenOptions, 'key'> = {},
): Promise<TestClient> => {
  const handshake = await openClient(url, { ...options, key });
  if (!handshake.opened) {
    throw new Error(`Handshake refused with HTTP ${handshake.status}`);
  }
  return handshake.client;
};
