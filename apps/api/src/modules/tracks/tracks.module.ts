import { Module } from '@nestjs/common';
import { MusicCatalogModule } from '../../integrations/music-catalog/music-catalog.module.js';
import { UsersModule } from '../users/users.module.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackProcessingService } from './track-processing.service.js';
import { TrackRequestService } from './track-request.service.js';
import { TrackRequesterService } from './track-requester.service.js';
import { TracksController } from './tracks.controller.js';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

@Module({
  imports: [MusicCatalogModule, UsersModule],
  controllers: [TracksController],
  providers: [
    TracksService,
    TracksRepository,
    TrackProcessingRepository,
    TrackRequestService,
    TrackProcessingService,
    TrackRequesterService,
  ],
  exports: [TracksService],
})
export class TracksModule {}
