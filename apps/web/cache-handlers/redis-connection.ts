type ExecResult = [error: Error | null, result: unknown][] | null;

/**
 * The subset of ioredis this handler uses, so tests can swap in an in-memory
 * fake. Every method rejects (never hangs forever) when Redis is unreachable
 * because the real client is created with `enableOfflineQueue: false`.
 */
export type CacheRedisClient = {
  getBuffer(key: string): Promise<Buffer | null>;
  set(key: string, value: Buffer, mode: 'PX', ttlMs: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hmget(key: string, ...fields: string[]): Promise<(string | null)[]>;
  zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]>;
  multi(commands: (string | number)[][]): { exec(): Promise<ExecResult> };
};

export type RedisConnectionOptions = {
  redis: CacheRedisClient;
  /** Upper bound for any single Redis round trip. */
  operationTimeoutMs: number;
  /** How long Redis is skipped after a failure before it is tried again. */
  failureCooldownMs: number;
  /** Minimum delay between two "Redis unavailable" warnings. */
  warnIntervalMs: number;
  now: () => number;
  warn: (message: string) => void;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis operation timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The Redis client behind a timeout on every call and a circuit breaker: after
 * a failure Redis is skipped for `failureCooldownMs`, and the warnings about
 * it are throttled.
 */
export class RedisConnection {
  readonly client: CacheRedisClient;
  readonly #options: RedisConnectionOptions;
  #unavailableUntil = 0;
  #lastWarnAt = Number.NEGATIVE_INFINITY;
  #suppressedWarnings = 0;

  constructor(options: RedisConnectionOptions) {
    this.client = options.redis;
    this.#options = options;
  }

  isAvailable(): boolean {
    return this.#options.now() >= this.#unavailableUntil;
  }

  /** Rejects when the operation takes longer than `operationTimeoutMs`. */
  run<T>(operation: Promise<T>): Promise<T> {
    return withTimeout(operation, this.#options.operationTimeoutMs);
  }

  /** Runs the commands in a MULTI and rejects if any of them failed. */
  async exec(commands: (string | number)[][]): Promise<void> {
    const results = await this.run(this.client.multi(commands).exec());
    if (results === null) throw new Error('Redis transaction was aborted');
    for (const [error] of results) {
      if (error) throw error;
    }
  }

  reportFailure(operation: string, error: unknown): void {
    const { now, failureCooldownMs, warnIntervalMs, warn } = this.#options;
    const at = now();
    this.#unavailableUntil = at + failureCooldownMs;
    if (at - this.#lastWarnAt < warnIntervalMs) {
      this.#suppressedWarnings += 1;
      return;
    }
    const reason = error instanceof Error ? error.message : String(error);
    const suppressed =
      this.#suppressedWarnings > 0
        ? ` (${this.#suppressedWarnings} similar warnings suppressed)`
        : '';
    warn(
      `[cache] Redis ${operation} failed, using the in-process cache only: ${reason}${suppressed}`,
    );
    this.#lastWarnAt = at;
    this.#suppressedWarnings = 0;
  }
}
