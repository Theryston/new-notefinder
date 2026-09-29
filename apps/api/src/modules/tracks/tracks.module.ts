import { Module } from '@nestjs/common';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

@Module({
  providers: [TracksService, TracksRepository],
  exports: [TracksService],
})
export class TracksModule {}
