import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { EditorialPinsModule } from '../editorial-pins/editorial-pins.module.js';
import { TrackLocaleTrendingService } from '../tracks/track-locale-trending.service.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { HomeController } from './home.controller.js';
import { HomeRepository } from './home.repository.js';
import { HomeService } from './home.service.js';
import { HOME_FEED_QUEUE } from './home-feed.job.js';
import { HomeFeedProcessor } from './home-feed.processor.js';
import { HomeFeedService } from './home-feed.service.js';
import { HomeFeedStore } from './home-feed.store.js';
import { HomeFeedBuilder } from './home-feed-builder.service.js';
import { HomePinOverlayService } from './home-pin-overlay.service.js';
import { createHomeRowSources, HOME_ROW_SOURCES } from './home-row-sources.js';
import { createVoiceRowSources } from './home-voice-row-sources.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: HOME_FEED_QUEUE }),
    TracksModule,
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
    HomeFeedBuilder,
    HomeFeedStore,
    HomeFeedService,
    HomeService,
    HomePinOverlayService,
    HomeFeedProcessor,
  ],
})
export class HomeModule {}
