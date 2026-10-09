import type { Env } from '../../config/env.js';
import { OpenAiTranscriptionClient } from './openai-transcription.client.js';

/**
 * The transcription client of the env. The key is required in production, so
 * the API refuses to boot there without it; elsewhere, without it, the lyrics
 * step of a Processing fails instead.
 */
export const createOpenAiTranscriptionClient = (
  env: Pick<Env, 'NODE_ENV' | 'OPENAI_API_KEY'>,
): OpenAiTranscriptionClient => {
  if (env.NODE_ENV === 'production' && env.OPENAI_API_KEY === undefined) {
    throw new Error('OPENAI_API_KEY is required in production');
  }
  return new OpenAiTranscriptionClient(env.OPENAI_API_KEY);
};
