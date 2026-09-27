import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Queue } from 'bullmq';

/**
 * Logs connection errors of every registered queue through Nest. Without a
 * listener BullMQ prints each reconnect failure with `console.error`.
 */
@Injectable()
export class QueueErrorLogger implements OnModuleInit {
  private readonly logger = new Logger('Queue');

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;
      if (instance instanceof Queue) {
        instance.on('error', (error: Error) => {
          this.logger.error(`${instance.name}: ${error.message}`);
        });
      }
    }
  }
}
