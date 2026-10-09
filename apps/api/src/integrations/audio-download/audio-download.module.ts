import { Module } from '@nestjs/common';
import { AudioDownloadClient } from './audio-download.client.js';

@Module({
  providers: [AudioDownloadClient],
  exports: [AudioDownloadClient],
})
export class AudioDownloadModule {}
