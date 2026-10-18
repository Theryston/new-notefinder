import { Module } from '@nestjs/common';
import { TracksModule } from '../tracks/tracks.module.js';
import { ArtistSitemapController } from './artist-sitemap.controller.js';
import { ArtistSitemapRepository } from './artist-sitemap.repository.js';
import { ArtistSitemapService } from './artist-sitemap.service.js';
import { ArtistsController } from './artists.controller.js';
import { ArtistsRepository } from './artists.repository.js';
import { ArtistsService } from './artists.service.js';

@Module({
  imports: [TracksModule],
  controllers: [ArtistsController, ArtistSitemapController],
  providers: [
    ArtistsService,
    ArtistsRepository,
    ArtistSitemapService,
    ArtistSitemapRepository,
  ],
  exports: [ArtistsService],
})
export class ArtistsModule {}
