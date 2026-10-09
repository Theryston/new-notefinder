import { Module } from '@nestjs/common';
import { CoverArtClient } from './cover-art.client.js';

@Module({
  providers: [CoverArtClient],
  exports: [CoverArtClient],
})
export class CoverArtModule {}
