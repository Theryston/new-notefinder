import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { OpenAiTranscriptionClient } from './openai-transcription.client.js';
import { createOpenAiTranscriptionClient } from './openai-transcription.factory.js';

/** The OpenAI transcription client, configured from the env. */
@Module({
  providers: [
    {
      provide: OpenAiTranscriptionClient,
      inject: [ENV],
      useFactory: (env: Env) => createOpenAiTranscriptionClient(env),
    },
  ],
  exports: [OpenAiTranscriptionClient],
})
export class OpenAiTranscriptionModule {}
