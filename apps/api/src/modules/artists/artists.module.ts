import { Module } from '@nestjs/common';
import { TracksModule } from '../tracks/tracks.module.js';
import { ArtistsController } from './artists.controller.js';
import { ArtistsRepository } from './artists.repository.js';
import { ArtistsService } from './artists.service.js';

@Module({
  imports: [TracksModule],
  controllers: [ArtistsController],
  providers: [ArtistsService, ArtistsRepository],
})
export class ArtistsModule {}
