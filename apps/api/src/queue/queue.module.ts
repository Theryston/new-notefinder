import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import type { QueueOptions } from 'bullmq';
import { ENV, type Env } from '../config/env.js';
import { AppWorker } from './app-worker.js';
import { QueueErrorLogger } from './queue-error-logger.js';

const HOUR_SECONDS = 60 * 60;

export const createQueueOptions = (env: Env): QueueOptions => ({
  // BullMQ opens its own connections from these options (workers need
  // blocking connections that retry forever), instead of the shared client.
  connection: { url: env.REDIS_URL },
  prefix: 'notefinder:bull',
  defaultJobOptions: {
    attempts: 5,
    // 5s, 10s, 20s, 40s between attempts.
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 24 * HOUR_SECONDS, count: 1000 },
    removeOnFail: { age: 7 * 24 * HOUR_SECONDS, count: 5000 },
  },
});

// Read when processors start (on module init), not at import time, so this
// applies to every `@Processor` whatever the module import order.
BullModule.workerClass = AppWorker;

/**
 * BullMQ root config. Features register their own queues with
 * `BullModule.registerQueue({ name: FEATURE_QUEUE })` and consume them in a
 * `<feature>.processor.ts`; `@nestjs/bullmq` closes workers and queues on
 * application shutdown.
 */
@Module({
  imports: [
    DiscoveryModule,
    BullModule.forRootAsync({
      inject: [ENV],
      useFactory: createQueueOptions,
    }),
  ],
  providers: [QueueErrorLogger],
})
export class QueueModule {}
