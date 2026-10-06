import { Module } from '@nestjs/common';
import { MusicCatalogModule } from '../../integrations/music-catalog/music-catalog.module.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [MusicCatalogModule, TracksModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
