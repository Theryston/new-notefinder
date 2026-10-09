import { createOpenAiTranscriptionClient } from './openai-transcription.factory.js';

describe('createOpenAiTranscriptionClient', () => {
  it('refuses to boot in production without the key', () => {
    expect(() =>
      createOpenAiTranscriptionClient({
        NODE_ENV: 'production',
        OPENAI_API_KEY: undefined,
      }),
    ).toThrow('OPENAI_API_KEY is required in production');
  });

  it('boots in production with the key', () => {
    expect(() =>
      createOpenAiTranscriptionClient({
        NODE_ENV: 'production',
        OPENAI_API_KEY: 'openai-key',
      }),
    ).not.toThrow();
  });

  it('boots without the key outside production, where a transcription fails instead', () => {
    expect(() =>
      createOpenAiTranscriptionClient({
        NODE_ENV: 'development',
        OPENAI_API_KEY: undefined,
      }),
    ).not.toThrow();
  });
});
