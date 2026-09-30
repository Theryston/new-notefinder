import {
  type MusicCatalogSearchResponse,
  musicCatalogSearchResponseSchema,
} from '@notefinder/contracts';
import type { TestClient } from './ws-client.js';

/**
 * Sends `search` and reads the answer with the contract's own schema, so a
 * response that breaks the protocol fails the spec.
 */
export const requestSearch = async (
  client: TestClient,
  payload: unknown,
): Promise<MusicCatalogSearchResponse> =>
  musicCatalogSearchResponseSchema.parse(
    await client.request('search', payload),
  );
