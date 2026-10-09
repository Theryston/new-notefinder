import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CoverArtModule } from '../../integrations/cover-art/cover-art.module.js';
import { MusicCatalogModule } from '../../integrations/music-catalog/music-catalog.module.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { YouTubeMusicModule } from '../../integrations/youtube-music/youtube-music.module.js';
import { UsersModule } from '../users/users.module.js';
import { TrackAlbumCoverService } from './track-album-cover.service.js';
import { TrackCoverService } from './track-cover.service.js';
import { TrackJobRunnerService } from './track-job-runner.service.js';
import { TRACK_METADATA_QUEUE } from './track-metadata.job.js';
import { TrackMetadataProcessor } from './track-metadata.processor.js';
import { TrackMetadataRepository } from './track-metadata.repository.js';
import { TrackMetadataService } from './track-metadata.service.js';
import { TrackMetadataImportService } from './track-metadata-import.service.js';
import { TrackPipelineService } from './track-pipeline.service.js';
import { TRACK_PROCESSING_QUEUE } from './track-processing.job.js';
import { TrackProcessingProcessor } from './track-processing.processor.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackProcessingService } from './track-processing.service.js';
import { TrackRequestService } from './track-request.service.js';
import { TrackRequestFlowService } from './track-request-flow.service.js';
import { TrackRequestLauncherService } from './track-request-launcher.service.js';
import { TrackRequesterService } from './track-requester.service.js';
import { TrackVideoService } from './track-video.service.js';
import { TrackVideoStepService } from './track-video-step.service.js';
import { TracksController } from './tracks.controller.js';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: TRACK_PROCESSING_QUEUE }),
    BullModule.registerQueue({ name: TRACK_METADATA_QUEUE }),
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
    TrackRequestLauncherService,
    TrackRequestFlowService,
    TrackProcessingService,
    TrackRequesterService,
    TrackVideoService,
    TrackVideoStepService,
    TrackCoverService,
    TrackPipelineService,
    TrackJobRunnerService,
    TrackProcessingProcessor,
    TrackMetadataRepository,
    TrackAlbumCoverService,
    TrackMetadataImportService,
    TrackMetadataService,
    TrackMetadataProcessor,
  ],
  exports: [TracksService],
})
export class TracksModule {}
