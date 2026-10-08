import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CoverArtModule } from '../../integrations/cover-art/cover-art.module.js';
import { MusicCatalogModule } from '../../integrations/music-catalog/music-catalog.module.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { YouTubeMusicModule } from '../../integrations/youtube-music/youtube-music.module.js';
import { UsersModule } from '../users/users.module.js';
import { TrackCoverService } from './track-cover.service.js';
import { TrackCoverJob } from './track-cover-job.service.js';
import { TrackJobRunner } from './track-job-runner.service.js';
import { TrackPipeline } from './track-pipeline.service.js';
import { TRACK_PROCESSING_QUEUE } from './track-processing.job.js';
import { TrackProcessingProcessor } from './track-processing.processor.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackProcessingService } from './track-processing.service.js';
import { TrackRequestService } from './track-request.service.js';
import { TrackRequestLauncher } from './track-request-launcher.service.js';
import { TrackVideoService } from './track-video.service.js';
import { TrackVideoStep } from './track-video-step.service.js';
import { TracksController } from './tracks.controller.js';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: TRACK_PROCESSING_QUEUE }),
    CoverArtModule,
    MusicCatalogModule,
    StorageModule,
    UsersModule,
    WebRevalidationModule,
    YouTubeMusicModule,
  ],
  controllers: [TracksController],
  providers: [
    TracksService,
    TracksRepository,
    TrackProcessingRepository,
    TrackRequestService,
    TrackRequestLauncher,
    TrackProcessingService,
    TrackVideoService,
    TrackVideoStep,
    TrackCoverService,
    TrackCoverJob,
    TrackPipeline,
    TrackJobRunner,
    TrackProcessingProcessor,
  ],
  exports: [TracksService],
})
export class TracksModule {}
