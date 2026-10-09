import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AudioDownloadModule } from '../../integrations/audio-download/audio-download.module.js';
import { CoverArtModule } from '../../integrations/cover-art/cover-art.module.js';
import { FfmpegModule } from '../../integrations/ffmpeg/ffmpeg.module.js';
import { MusicCatalogModule } from '../../integrations/music-catalog/music-catalog.module.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { YouTubeMusicModule } from '../../integrations/youtube-music/youtube-music.module.js';
import { TRACK_METADATA_QUEUE } from '../../queue/track-metadata.job.js';
import { UsersModule } from '../users/users.module.js';
import { TrackAlbumCoverService } from './track-album-cover.service.js';
import { TrackAudioService } from './track-audio.service.js';
import { TrackCoverService } from './track-cover.service.js';
import { TrackJobRunnerService } from './track-job-runner.service.js';
import { TrackMetadataQueueService } from './track-metadata-queue.service.js';
import { TrackPipelineService } from './track-pipeline.service.js';
import { TRACK_PROCESSING_QUEUE } from './track-processing.job.js';
import { TrackProcessingProcessor } from './track-processing.processor.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackProcessingService } from './track-processing.service.js';
import { TrackRequestService } from './track-request.service.js';
import { TrackRequestFlowService } from './track-request-flow.service.js';
import { TrackRequestLauncherService } from './track-request-launcher.service.js';
import { TrackRequesterService } from './track-requester.service.js';
import { TrackStepsService } from './track-steps.service.js';
import { TrackVideoService } from './track-video.service.js';
import { TrackVideoStepService } from './track-video-step.service.js';
import { TracksController } from './tracks.controller.js';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

/**
 * Tracks: requests, Processings and the Track pages. It queues the metadata
 * import but does not run it: that lives in the track-metadata module, which
 * imports this one, so this module never depends on Artists or Albums.
 */
@Module({
  imports: [
    AudioDownloadModule,
    BullModule.registerQueue({ name: TRACK_PROCESSING_QUEUE }),
    BullModule.registerQueue({ name: TRACK_METADATA_QUEUE }),
    CoverArtModule,
    FfmpegModule,
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
    TrackMetadataQueueService,
    TrackProcessingService,
    TrackRequesterService,
    TrackVideoService,
    TrackVideoStepService,
    TrackAudioService,
    TrackCoverService,
    TrackAlbumCoverService,
    TrackStepsService,
    TrackPipelineService,
    TrackJobRunnerService,
    TrackProcessingProcessor,
  ],
  exports: [TracksService, TrackAlbumCoverService],
})
export class TracksModule {}
