import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { EditorialPinsModule } from '../editorial-pins/editorial-pins.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { TrackLocaleTrendingService } from '../tracks/track-locale-trending.service.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { UsersModule } from '../users/users.module.js';
import { HomeController } from './home.controller.js';
import { HomeRepository } from './home.repository.js';
import { HomeService } from './home.service.js';
import { HOME_FEED_QUEUE } from './home-feed.job.js';
import { HomeFeedProcessor } from './home-feed.processor.js';
import { HomeFeedService } from './home-feed.service.js';
import { HomeFeedStore } from './home-feed.store.js';
import { HomeFeedBuilder } from './home-feed-builder.service.js';
import { PERSONAL_HOME_FEED_QUEUE } from './home-personal.job.js';
import { PersonalHomeProcessor } from './home-personal.processor.js';
import { PersonalHomeRepository } from './home-personal.repository.js';
import { PersonalHomeStore } from './home-personal.store.js';
import { PersonalHomeBuilder } from './home-personal-builder.service.js';
import { PersonalHomeQueueService } from './home-personal-queue.service.js';
import { HomePinOverlayService } from './home-pin-overlay.service.js';
import {
  createHomeEntityRowSources,
  createHomeRowSources,
  HOME_ENTITY_ROW_SOURCES,
  HOME_ROW_SOURCES,
} from './home-row-sources.js';
import { createVoiceRowSources } from './home-voice-row-sources.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: HOME_FEED_QUEUE }),
    BullModule.registerQueue({ name: PERSONAL_HOME_FEED_QUEUE }),
    TracksModule,
    UsersModule,
    StreaksModule,
    WebRevalidationModule,
    EditorialPinsModule,
  ],
  controllers: [HomeController],
  providers: [
    HomeRepository,
    {
      provide: HOME_ROW_SOURCES,
      inject: [HomeRepository, TrackLocaleTrendingService],
      useFactory: (
        repository: HomeRepository,
        ranking: TrackLocaleTrendingService,
      ) => [
        ...createHomeRowSources(repository, ranking),
        ...createVoiceRowSources(repository),
      ],
    },
    {
      provide: HOME_ENTITY_ROW_SOURCES,
      inject: [HomeRepository],
      useFactory: createHomeEntityRowSources,
    },
    HomeFeedBuilder,
    HomeFeedStore,
    HomeFeedService,
    HomeService,
    HomePinOverlayService,
    HomeFeedProcessor,
    PersonalHomeRepository,
    PersonalHomeStore,
    PersonalHomeBuilder,
    PersonalHomeQueueService,
    PersonalHomeProcessor,
  ],
  exports: [PersonalHomeQueueService],
})
export class HomeModule {}
