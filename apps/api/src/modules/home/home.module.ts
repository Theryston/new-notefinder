import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { HomeController } from './home.controller.js';
import { HomeRepository } from './home.repository.js';
import { HomeService } from './home.service.js';
import { HOME_FEED_QUEUE } from './home-feed.job.js';
import { HomeFeedProcessor } from './home-feed.processor.js';
import { HomeFeedService } from './home-feed.service.js';
import { HomeFeedStore } from './home-feed.store.js';
import { HomeFeedBuilder } from './home-feed-builder.service.js';
import { createHomeRowSources, HOME_ROW_SOURCES } from './home-row-sources.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: HOME_FEED_QUEUE }),
    WebRevalidationModule,
  ],
  controllers: [HomeController],
  providers: [
    HomeRepository,
    {
      provide: HOME_ROW_SOURCES,
      inject: [HomeRepository],
      useFactory: createHomeRowSources,
    },
    HomeFeedBuilder,
    HomeFeedStore,
    HomeFeedService,
    HomeService,
    HomeFeedProcessor,
  ],
})
export class HomeModule {}
