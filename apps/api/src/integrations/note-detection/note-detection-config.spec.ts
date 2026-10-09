import { resolveNoteDetectionConfig } from './note-detection-config.js';

describe('resolveNoteDetectionConfig', () => {
  it('answers the key and the endpoint when both are set', () => {
    expect(
      resolveNoteDetectionConfig({
        RUNPOD_API_KEY: 'runpod-key',
        RUNPOD_ENDPOINT_ID: 'endpoint-1',
      }),
    ).toEqual({ apiKey: 'runpod-key', endpointId: 'endpoint-1' });
  });

  it('is not configured when the API key is missing', () => {
    expect(
      resolveNoteDetectionConfig({
        RUNPOD_API_KEY: undefined,
        RUNPOD_ENDPOINT_ID: 'endpoint-1',
      }),
    ).toBeUndefined();
  });

  it('is not configured when the endpoint ID is missing', () => {
    expect(
      resolveNoteDetectionConfig({
        RUNPOD_API_KEY: 'runpod-key',
        RUNPOD_ENDPOINT_ID: undefined,
      }),
    ).toBeUndefined();
  });
});
