import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AudioDownloadModule } from '../../integrations/audio-download/audio-download.module.js';
import { CoverArtModule } from '../../integrations/cover-art/cover-art.module.js';
import { EmailModule } from '../../integrations/email/email.module.js';
import { FfmpegModule } from '../../integrations/ffmpeg/ffmpeg.module.js';
import { MusicCatalogModule } from '../../integrations/music-catalog/music-catalog.module.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { YouTubeMusicModule } from '../../integrations/youtube-music/youtube-music.module.js';
import { UsersModule } from '../users/users.module.js';
import { TrackAudioService } from './track-audio.service.js';
import { TrackContributorEmailsService } from './track-contributor-emails.service.js';
import { TrackCoverService } from './track-cover.service.js';
import { TrackJobRunnerService } from './track-job-runner.service.js';
import { TrackPipelineService } from './track-pipeline.service.js';
import { TRACK_PROCESSING_QUEUE } from './track-processing.job.js';
import { TrackProcessingProcessor } from './track-processing.processor.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackProcessingService } from './track-processing.service.js';
import { TrackRequestService } from './track-request.service.js';
import { TrackRequestLauncherService } from './track-request-launcher.service.js';
import { TrackRequesterService } from './track-requester.service.js';
import { TrackRetryRepository } from './track-retry.repository.js';
import { TrackRetryService } from './track-retry.service.js';
import { TrackRetryLauncherService } from './track-retry-launcher.service.js';
import { TrackStepsService } from './track-steps.service.js';
import { TrackVideoService } from './track-video.service.js';
import { TrackVideoStepService } from './track-video-step.service.js';
import { TracksController } from './tracks.controller.js';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

@Module({
  imports: [
    AudioDownloadModule,
    BullModule.registerQueue({ name: TRACK_PROCESSING_QUEUE }),
    CoverArtModule,
    EmailModule,
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
    TrackRetryRepository,
    TrackRetryService,
    TrackRetryLauncherService,
    TrackContributorEmailsService,
    TrackProcessingService,
    TrackRequesterService,
    TrackVideoService,
    TrackVideoStepService,
    TrackAudioService,
    TrackCoverService,
    TrackStepsService,
    TrackPipelineService,
    TrackJobRunnerService,
    TrackProcessingProcessor,
  ],
  exports: [TracksService],
})
export class TracksModule {}
