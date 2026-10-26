import { z } from 'zod';
import { mbidSchema } from './music-catalog.js';

/** A Track projection for one exact MusicBrainz Recording MBID. */
export const musicCatalogTrackAssociationPayloadSchema = z.object({
  mbid: mbidSchema,
  trackId: z.guid().nullable(),
});

export type MusicCatalogTrackAssociationPayload = z.infer<
  typeof musicCatalogTrackAssociationPayloadSchema
>;

/** Empty acknowledgment: success means the association and retry work are durable. */
export const musicCatalogTrackAssociationResultSchema = z.object({});

export type MusicCatalogTrackAssociationResult = z.infer<
  typeof musicCatalogTrackAssociationResultSchema
>;
