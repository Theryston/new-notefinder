import { resolveNoteDetectionConfig } from './note-detection-config.js';

const keys = { RUNPOD_API_KEY: 'runpod-key', RUNPOD_ENDPOINT_ID: 'endpoint-1' };

describe('resolveNoteDetectionConfig', () => {
  it('answers the key and the endpoint when both are set', () => {
    expect(
      resolveNoteDetectionConfig({ NODE_ENV: 'production', ...keys }),
    ).toEqual({ apiKey: 'runpod-key', endpointId: 'endpoint-1' });
  });

  it('is not configured outside production when either variable is missing', () => {
    expect(
      resolveNoteDetectionConfig({
        NODE_ENV: 'development',
        RUNPOD_API_KEY: undefined,
        RUNPOD_ENDPOINT_ID: undefined,
      }),
    ).toBeUndefined();
    expect(
      resolveNoteDetectionConfig({
        NODE_ENV: 'test',
        RUNPOD_API_KEY: 'runpod-key',
        RUNPOD_ENDPOINT_ID: undefined,
      }),
    ).toBeUndefined();
  });

  it('refuses to boot in production without the API key', () => {
    expect(() =>
      resolveNoteDetectionConfig({
        NODE_ENV: 'production',
        RUNPOD_API_KEY: undefined,
        RUNPOD_ENDPOINT_ID: 'endpoint-1',
      }),
    ).toThrow('RUNPOD_API_KEY');
  });

  it('refuses to boot in production without the endpoint ID', () => {
    expect(() =>
      resolveNoteDetectionConfig({
        NODE_ENV: 'production',
        RUNPOD_API_KEY: 'runpod-key',
        RUNPOD_ENDPOINT_ID: undefined,
      }),
    ).toThrow('RUNPOD_ENDPOINT_ID');
  });
});
