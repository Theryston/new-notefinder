import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { NoteDetectionClient } from './note-detection.client.js';
import { resolveNoteDetectionConfig } from './note-detection-config.js';

/**
 * The RunPod client of the note detection. It throws while the app boots when
 * production has no RunPod configuration.
 */
@Module({
  providers: [
    {
      provide: NoteDetectionClient,
      inject: [ENV],
      useFactory: (env: Env) =>
        new NoteDetectionClient(resolveNoteDetectionConfig(env)),
    },
  ],
  exports: [NoteDetectionClient],
})
export class NoteDetectionModule {}
