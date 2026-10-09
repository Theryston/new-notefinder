import { Module } from '@nestjs/common';
import { FfmpegClient } from './ffmpeg.client.js';

@Module({
  providers: [FfmpegClient],
  exports: [FfmpegClient],
})
export class FfmpegModule {}
