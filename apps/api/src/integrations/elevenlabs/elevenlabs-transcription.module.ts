import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { ElevenLabsTranscriptionClient } from './elevenlabs-transcription.client.js';
import { createElevenLabsTranscriptionClient } from './elevenlabs-transcription.factory.js';

/** The ElevenLabs transcription client, configured from the env. */
@Module({
  providers: [
    {
      provide: ElevenLabsTranscriptionClient,
      inject: [ENV],
      useFactory: (env: Env) => createElevenLabsTranscriptionClient(env),
    },
  ],
  exports: [ElevenLabsTranscriptionClient],
})
export class ElevenLabsTranscriptionModule {}
