import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { NoteDetectionClient } from './note-detection.client.js';
import { resolveNoteDetectionConfig } from './note-detection-config.js';

/** The RunPod client of the note detection, configured from the env. */
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
