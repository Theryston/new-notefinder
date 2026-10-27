import { z } from 'zod';
import {
  mbidSchema,
  musicCatalogErrorResponseSchema,
  musicCatalogSuccessResponseSchema,
} from './music-catalog.js';

/** A Track projection for one exact MusicBrainz Recording MBID. */
export const musicCatalogTrackAssociationPayloadSchema = z.object({
  mbid: mbidSchema,
  trackId: z.string().min(1).max(128).nullable(),
});

export type MusicCatalogTrackAssociationPayload = z.infer<
  typeof musicCatalogTrackAssociationPayloadSchema
>;

/** Empty acknowledgment: success means the association and retry work are durable. */
export const musicCatalogTrackAssociationResultSchema = z.object({});

export type MusicCatalogTrackAssociationResult = z.infer<
  typeof musicCatalogTrackAssociationResultSchema
>;

/** What the catalog answers after the association and its index work are durable. */
export const musicCatalogAssociateTrackResponseSchema = z.discriminatedUnion(
  'ok',
  [
    musicCatalogSuccessResponseSchema(musicCatalogTrackAssociationResultSchema),
    musicCatalogErrorResponseSchema,
  ],
);

export type MusicCatalogAssociateTrackResponse = z.infer<
  typeof musicCatalogAssociateTrackResponseSchema
>;
