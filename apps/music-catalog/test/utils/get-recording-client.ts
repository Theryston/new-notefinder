import {
  type MusicCatalogGetRecordingResponse,
  musicCatalogGetRecordingResponseSchema,
} from '@notefinder/contracts';
import type { TestClient } from './ws-client.js';

/**
 * Sends `getRecording` and reads the answer with the contract's own schema,
 * so a response that breaks the protocol fails the spec.
 */
export const requestRecording = async (
  client: TestClient,
  payload: unknown,
): Promise<MusicCatalogGetRecordingResponse> =>
  musicCatalogGetRecordingResponseSchema.parse(
    await client.request('getRecording', payload),
  );
