import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventsController } from './events.controller.js';
import { EVENTS_QUEUE } from './events.job.js';
import { EventsProcessor } from './events.processor.js';
import { EventsRepository } from './events.repository.js';
import { EventsService } from './events.service.js';
import { EventsAnalyticsService } from './events-analytics.service.js';

/** Engagement events: batch ingestion buffered in Redis, stored raw. */
@Module({
  imports: [BullModule.registerQueue({ name: EVENTS_QUEUE })],
  controllers: [EventsController],
  providers: [
    EventsRepository,
    EventsService,
    EventsAnalyticsService,
    EventsProcessor,
  ],
  exports: [EventsAnalyticsService],
})
export class EventsModule {}
