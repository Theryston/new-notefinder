import type { Env } from '../../config/env.js';
import { ElevenLabsTranscriptionClient } from './elevenlabs-transcription.client.js';

/**
 * The transcription client of the env. The key is required in production, so
 * the API refuses to boot there without it; elsewhere, without it, the lyrics
 * step of a Processing fails instead.
 */
export const createElevenLabsTranscriptionClient = (
  env: Pick<Env, 'NODE_ENV' | 'ELEVENLABS_API_KEY'>,
): ElevenLabsTranscriptionClient => {
  if (env.NODE_ENV === 'production' && env.ELEVENLABS_API_KEY === undefined) {
    throw new Error('ELEVENLABS_API_KEY is required in production');
  }
  return new ElevenLabsTranscriptionClient(env.ELEVENLABS_API_KEY);
};
