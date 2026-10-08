import {
  type MusicCatalogGetReleaseGroupResponse,
  musicCatalogGetReleaseGroupResponseSchema,
} from '@notefinder/contracts';
import type { TestClient } from './ws-client.js';

/**
 * Sends `getReleaseGroup` and reads the answer with the contract's own schema,
 * so a response that breaks the protocol fails the spec.
 */
export const requestReleaseGroup = async (
  client: TestClient,
  payload: unknown,
): Promise<MusicCatalogGetReleaseGroupResponse> =>
  musicCatalogGetReleaseGroupResponseSchema.parse(
    await client.request('getReleaseGroup', payload),
  );
