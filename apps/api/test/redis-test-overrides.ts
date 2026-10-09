import { getQueueToken } from '@nestjs/bullmq';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { EMAIL_QUEUE } from '../src/integrations/email/email.job.js';
import { EmailProcessor } from '../src/integrations/email/email.processor.js';
import { WEB_REVALIDATION_QUEUE } from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { WebRevalidationProcessor } from '../src/integrations/web-revalidation/web-revalidation.processor.js';
import { TrackMetadataProcessor } from '../src/modules/track-metadata/track-metadata.processor.js';
import { TRACK_PROCESSING_QUEUE } from '../src/modules/tracks/track-processing.job.js';
import { TrackProcessingProcessor } from '../src/modules/tracks/track-processing.processor.js';
import { TRACK_METADATA_QUEUE } from '../src/queue/track-metadata.job.js';
import { REDIS_CLIENT } from '../src/redis/redis.constants.js';

/** Every BullMQ queue registered by the app; add new queues here. */
const QUEUES = [
  WEB_REVALIDATION_QUEUE,
  EMAIL_QUEUE,
  TRACK_PROCESSING_QUEUE,
  TRACK_METADATA_QUEUE,
] as const;
/** Every BullMQ processor; overriding one keeps its worker from starting. */
const PROCESSORS = [
  WebRevalidationProcessor,
  EmailProcessor,
  TrackProcessingProcessor,
  TrackMetadataProcessor,
] as const;

export type FakeQueue = {
  added: { name: string; data: unknown }[];
  add: (name: string, data: unknown) => Promise<{ id: string }>;
};

const createFakeQueue = (): FakeQueue => {
  const added: FakeQueue['added'] = [];
  return {
    added,
    add: async (name, data) => {
      added.push({ name, data });
      return { id: String(added.length) };
    },
  };
};

// Only what the shutdown hook and the readiness check touch (reported as
// healthy): any other Redis command called on it throws (not a function), so
// a provider missed by these overrides fails loudly instead of trying to
// connect.
const redisStub = {
  status: 'wait',
  disconnect: () => undefined,
  ping: async () => 'PONG',
};

/**
 * Replaces every Redis-backed provider (shared client, rate-limit storage,
 * BullMQ queues and workers) so e2e specs run without a Redis server.
 * Returns the fake queues, keyed by queue name, to assert enqueued jobs.
 */
export const overrideRedisProviders = (
  builder: TestingModuleBuilder,
): { builder: TestingModuleBuilder; queues: Record<string, FakeQueue> } => {
  const queues: Record<string, FakeQueue> = {};
  let result = builder
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisStub)
    .overrideProvider(ThrottlerStorage)
    .useValue(new ThrottlerStorageService());
  for (const name of QUEUES) {
    const queue = createFakeQueue();
    queues[name] = queue;
    result = result.overrideProvider(getQueueToken(name)).useValue(queue);
  }
  for (const processor of PROCESSORS) {
    result = result.overrideProvider(processor).useValue({});
  }
  return { builder: result, queues };
};
