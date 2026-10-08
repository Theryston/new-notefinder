import {
  type MusicCatalogGetArtistResponse,
  musicCatalogGetArtistResponseSchema,
} from '@notefinder/contracts';
import type { TestClient } from './ws-client.js';

/**
 * Sends `getArtist` and reads the answer with the contract's own schema, so a
 * response that breaks the protocol fails the spec.
 */
export const requestArtist = async (
  client: TestClient,
  payload: unknown,
): Promise<MusicCatalogGetArtistResponse> =>
  musicCatalogGetArtistResponseSchema.parse(
    await client.request('getArtist', payload),
  );
