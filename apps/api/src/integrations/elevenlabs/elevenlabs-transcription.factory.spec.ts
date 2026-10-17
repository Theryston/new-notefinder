import { createElevenLabsTranscriptionClient } from './elevenlabs-transcription.factory.js';

describe('createElevenLabsTranscriptionClient', () => {
  it('refuses to boot in production without the key', () => {
    expect(() =>
      createElevenLabsTranscriptionClient({
        NODE_ENV: 'production',
        ELEVENLABS_API_KEY: undefined,
      }),
    ).toThrow('ELEVENLABS_API_KEY is required in production');
  });

  it('boots in production with the key', () => {
    expect(() =>
      createElevenLabsTranscriptionClient({
        NODE_ENV: 'production',
        ELEVENLABS_API_KEY: 'elevenlabs-key',
      }),
    ).not.toThrow();
  });

  it('boots without the key outside production, where a transcription fails instead', () => {
    expect(() =>
      createElevenLabsTranscriptionClient({
        NODE_ENV: 'development',
        ELEVENLABS_API_KEY: undefined,
      }),
    ).not.toThrow();
  });
});
