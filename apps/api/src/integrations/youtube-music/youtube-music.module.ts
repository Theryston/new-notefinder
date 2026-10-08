import { Module } from '@nestjs/common';
import { YouTubeMusicClient } from './youtube-music.client.js';

@Module({
  providers: [YouTubeMusicClient],
  exports: [YouTubeMusicClient],
})
export class YouTubeMusicModule {}
