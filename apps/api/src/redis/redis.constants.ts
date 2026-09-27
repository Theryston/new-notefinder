/** Injection token for the shared ioredis client: `@Inject(REDIS_CLIENT)`. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

const KEY_PREFIX = 'notefinder';

/**
 * Builds a namespaced key, `notefinder:<feature>:<...parts>`, so features never
 * collide with each other (or with BullMQ's `notefinder:bull:*` keys) and a
 * whole feature can be inspected or flushed by prefix.
 */
export const redisKey = (feature: string, ...parts: string[]): string =>
  [KEY_PREFIX, feature, ...parts].join(':');
