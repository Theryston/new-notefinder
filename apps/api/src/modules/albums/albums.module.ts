import { Module } from '@nestjs/common';
import { TracksModule } from '../tracks/tracks.module.js';
import { AlbumSitemapController } from './album-sitemap.controller.js';
import { AlbumSitemapRepository } from './album-sitemap.repository.js';
import { AlbumSitemapService } from './album-sitemap.service.js';
import { AlbumsController } from './albums.controller.js';
import { AlbumsRepository } from './albums.repository.js';
import { AlbumsService } from './albums.service.js';

@Module({
  imports: [TracksModule],
  controllers: [AlbumsController, AlbumSitemapController],
  providers: [
    AlbumsService,
    AlbumsRepository,
    AlbumSitemapService,
    AlbumSitemapRepository,
  ],
  exports: [AlbumsService],
})
export class AlbumsModule {}
