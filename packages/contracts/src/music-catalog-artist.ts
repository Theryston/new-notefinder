import { z } from 'zod';
import {
  mbidSchema,
  musicCatalogErrorResponseSchema,
  musicCatalogGenreSchema,
  musicCatalogSuccessResponseSchema,
} from './music-catalog.js';

// The artist as the Music catalog describes it, returned by `getArtist`. Part
// of the Music catalog protocol (music-catalog.ts), kept in its own file like
// the Recording. Every field is always present, null or empty when unknown.

/** `getArtist` payload: the MBID of the artist. */
export const musicCatalogGetArtistPayloadSchema = z.object({
  mbid: mbidSchema,
});

export type MusicCatalogGetArtistPayload = z.infer<
  typeof musicCatalogGetArtistPayloadSchema
>;

export const musicCatalogArtistSchema = z.object({
  mbid: mbidSchema,
  /** The artist's own name, as MusicBrainz has it. */
  name: z.string(),
  /** The artist's own genres, most voted first, by name on a tie. */
  genres: z.array(musicCatalogGenreSchema),
});

export type MusicCatalogArtist = z.infer<typeof musicCatalogArtistSchema>;

/** What a client reads back for a `getArtist` request. */
export const musicCatalogGetArtistResponseSchema = z.discriminatedUnion('ok', [
  musicCatalogSuccessResponseSchema(musicCatalogArtistSchema),
  musicCatalogErrorResponseSchema,
]);

export type MusicCatalogGetArtistResponse = z.infer<
  typeof musicCatalogGetArtistResponseSchema
>;
