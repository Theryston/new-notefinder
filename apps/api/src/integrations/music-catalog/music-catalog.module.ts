import { Module } from '@nestjs/common';
import { MusicCatalogClient } from './music-catalog.client.js';

@Module({
  providers: [MusicCatalogClient],
  exports: [MusicCatalogClient],
})
export class MusicCatalogModule {}
