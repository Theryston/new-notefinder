import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PERSONAL_HOME_FEED_QUEUE } from './home-personal.job.js';
import { PersonalHomeQueueService } from './home-personal-queue.service.js';

/** Attempts and Favorites schedule refreshes through this module without importing HomeModule. */
@Module({
  imports: [BullModule.registerQueue({ name: PERSONAL_HOME_FEED_QUEUE })],
  providers: [PersonalHomeQueueService],
  exports: [PersonalHomeQueueService],
})
export class PersonalHomeQueueModule {}
