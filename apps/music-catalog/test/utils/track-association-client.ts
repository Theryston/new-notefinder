import {
  type MusicCatalogTrackAssociationPayload,
  type MusicCatalogTrackAssociationResult,
  musicCatalogTrackAssociationResultSchema,
} from '@notefinder/contracts';
import type { TestClient } from './ws-client.js';

export const requestTrackAssociation = async (
  client: TestClient,
  payload: MusicCatalogTrackAssociationPayload,
): Promise<MusicCatalogTrackAssociationResult> => {
  const response: unknown = await client.request('associateTrack', payload);
  if (
    typeof response !== 'object' ||
    response === null ||
    !('ok' in response) ||
    response.ok !== true ||
    !('result' in response)
  ) {
    throw new Error('Track association was not acknowledged.');
  }
  return musicCatalogTrackAssociationResultSchema.parse(response.result);
};
