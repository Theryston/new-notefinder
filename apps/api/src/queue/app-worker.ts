import { Logger } from '@nestjs/common';
import { Worker } from 'bullmq';

const logger = new Logger('Worker');

/**
 * Worker class used for every `@Processor` (set in `queue.module.ts`):
 * - logs errors through Nest (BullMQ prints them with `console.error`
 *   when nothing listens);
 * - skips the graceful close when Redis never connected, which otherwise
 *   waits for the connection forever and blocks the process shutdown. Without
 *   a connection there is no job in flight to wait for.
 */
export class AppWorker extends Worker {
  constructor(...args: ConstructorParameters<typeof Worker>) {
    super(...args);
    this.on('error', (error: Error) => {
      logger.error(`${this.name}: ${error.message}`);
    });
  }

  override close(force = false): Promise<void> {
    return super.close(force || this.backend.connection.status !== 'ready');
  }
}
