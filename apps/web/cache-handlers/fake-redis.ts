import type { CacheRedisClient } from './redis-cache-handler.ts';

type Value =
  | { kind: 'string'; value: Buffer; expiresAt?: number }
  | { kind: 'hash'; value: Map<string, string> }
  | { kind: 'zset'; value: Map<string, number> };

const parseBound = (bound: number | string) => {
  if (bound === '-inf') return Number.NEGATIVE_INFINITY;
  if (bound === '+inf') return Number.POSITIVE_INFINITY;
  return Number(bound);
};

/**
 * In-memory stand-in for the ioredis commands the cache handler uses, for
 * unit tests. One store can be shared by several handler instances to
 * simulate several Next processes talking to the same Redis.
 */
export class FakeRedisStore {
  readonly data = new Map<string, Value>();
  now: () => number = Date.now;

  #string(key: string) {
    const item = this.data.get(key);
    if (!item) return undefined;
    if (item.kind !== 'string') throw new Error('WRONGTYPE');
    if (item.expiresAt !== undefined && item.expiresAt <= this.now()) {
      this.data.delete(key);
      return undefined;
    }
    return item;
  }

  #hash(key: string) {
    const item = this.data.get(key) ?? { kind: 'hash', value: new Map() };
    if (item.kind !== 'hash') throw new Error('WRONGTYPE');
    this.data.set(key, item);
    return item.value;
  }

  #zset(key: string) {
    const item = this.data.get(key) ?? { kind: 'zset', value: new Map() };
    if (item.kind !== 'zset') throw new Error('WRONGTYPE');
    this.data.set(key, item);
    return item.value;
  }

  getBuffer(key: string) {
    return this.#string(key)?.value ?? null;
  }

  get(key: string) {
    return this.#string(key)?.value.toString() ?? null;
  }

  set(key: string, value: Buffer | string, ttlMs?: number) {
    this.data.set(key, {
      kind: 'string',
      value: Buffer.from(value),
      expiresAt: ttlMs === undefined ? undefined : this.now() + ttlMs,
    });
    return 'OK';
  }

  ttl(key: string) {
    const expiresAt = this.#string(key)?.expiresAt;
    return expiresAt === undefined ? undefined : expiresAt - this.now();
  }

  hset(key: string, ...fieldValues: (string | number)[]) {
    const hash = this.#hash(key);
    for (let i = 0; i < fieldValues.length; i += 2) {
      hash.set(String(fieldValues[i]), String(fieldValues[i + 1]));
    }
    return fieldValues.length / 2;
  }

  hdel(key: string, ...fields: (string | number)[]) {
    const hash = this.#hash(key);
    return fields.filter((field) => hash.delete(String(field))).length;
  }

  hgetall(key: string) {
    return Object.fromEntries(this.#hash(key));
  }

  hmget(key: string, ...fields: string[]) {
    const hash = this.#hash(key);
    return fields.map((field) => hash.get(field) ?? null);
  }

  zadd(key: string, ...scoreMembers: (string | number)[]) {
    const zset = this.#zset(key);
    for (let i = 0; i < scoreMembers.length; i += 2) {
      zset.set(String(scoreMembers[i + 1]), Number(scoreMembers[i]));
    }
    return scoreMembers.length / 2;
  }

  zrem(key: string, ...members: (string | number)[]) {
    const zset = this.#zset(key);
    return members.filter((member) => zset.delete(String(member))).length;
  }

  zrangebyscore(key: string, min: number | string, max: number | string) {
    const [low, high] = [parseBound(min), parseBound(max)];
    return [...this.#zset(key)]
      .filter(([, score]) => score >= low && score <= high)
      .sort(([, a], [, b]) => a - b)
      .map(([member]) => member);
  }

  run(command: (string | number)[]): unknown {
    const [name, key, ...args] = command;
    const k = String(key);
    switch (name) {
      case 'hset':
        return this.hset(k, ...args);
      case 'hdel':
        return this.hdel(k, ...args);
      case 'zadd':
        return this.zadd(k, ...args);
      case 'zrem':
        return this.zrem(k, ...args);
      case 'set':
        return this.set(k, String(args[0]));
      default:
        throw new Error(`FakeRedis: unsupported command ${String(name)}`);
    }
  }
}

export type FakeRedisClient = CacheRedisClient & {
  /** Makes every command reject (or hang when `'hang'`), like a dead Redis. */
  failWith: Error | 'hang' | undefined;
  calls: string[];
};

/** A client bound to a shared store, with failure injection. */
export function createFakeRedisClient(store: FakeRedisStore): FakeRedisClient {
  const client: FakeRedisClient = {
    failWith: undefined,
    calls: [],
    getBuffer: (key) => call('getBuffer', () => store.getBuffer(key)),
    get: (key) => call('get', () => store.get(key)),
    set: (key, value, _mode, ttlMs) =>
      call('set', () => store.set(key, value, ttlMs)),
    hgetall: (key) => call('hgetall', () => store.hgetall(key)),
    hmget: (key, ...fields) => call('hmget', () => store.hmget(key, ...fields)),
    zrangebyscore: (key, min, max) =>
      call('zrangebyscore', () => store.zrangebyscore(key, min, max)),
    multi: (commands) => ({
      exec: () =>
        call('multi', () =>
          commands.map((command): [Error | null, unknown] => [
            null,
            store.run(command),
          ]),
        ),
    }),
  };

  function call<T>(name: string, run: () => T): Promise<T> {
    client.calls.push(name);
    if (client.failWith === 'hang') return new Promise<T>(() => {});
    if (client.failWith) return Promise.reject(client.failWith);
    return Promise.resolve(run());
  }

  return client;
}
