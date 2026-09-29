import { Module } from '@nestjs/common';
import { TracksModule } from '../tracks/tracks.module.js';
import { AlbumsController } from './albums.controller.js';
import { AlbumsRepository } from './albums.repository.js';
import { AlbumsService } from './albums.service.js';

@Module({
  imports: [TracksModule],
  controllers: [AlbumsController],
  providers: [AlbumsService, AlbumsRepository],
})
export class AlbumsModule {}
