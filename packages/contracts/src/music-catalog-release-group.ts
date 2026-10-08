import { z } from 'zod';
import {
  mbidSchema,
  musicCatalogErrorResponseSchema,
  musicCatalogGenreSchema,
  musicCatalogSuccessResponseSchema,
} from './music-catalog.js';
import { recordingArtistCreditSchema } from './music-catalog-recording.js';

// The release group (an Album, ADR 0003) as the Music catalog describes it,
// returned by `getReleaseGroup`. Part of the Music catalog protocol
// (music-catalog.ts), kept in its own file like the Recording. Every field is
// always present: what the catalog does not know is null or empty, never
// omitted.

/** `getReleaseGroup` payload: the MBID of the release group. */
export const musicCatalogGetReleaseGroupPayloadSchema = z.object({
  mbid: mbidSchema,
});

export type MusicCatalogGetReleaseGroupPayload = z.infer<
  typeof musicCatalogGetReleaseGroupPayloadSchema
>;

/** One track of a medium: its position and the Recording it holds. */
export const musicCatalogReleaseTrackSchema = z.object({
  position: z.number().int(),
  recordingMbid: mbidSchema,
});

export type MusicCatalogReleaseTrack = z.infer<
  typeof musicCatalogReleaseTrackSchema
>;

/** One medium (disc) of a release, in position order. */
export const musicCatalogReleaseMediumSchema = z.object({
  position: z.number().int(),
  /** The medium's own title; '' when it has none. */
  title: z.string(),
  tracks: z.array(musicCatalogReleaseTrackSchema),
});

export type MusicCatalogReleaseMedium = z.infer<
  typeof musicCatalogReleaseMediumSchema
>;

/**
 * The release the album's track order is taken from: the earliest Official
 * release, or the earliest release of any status when none is Official, by
 * its earliest release event (dated before undated), ties by MBID. Chosen by
 * the catalog, so repeated calls agree.
 */
export const musicCatalogRepresentativeReleaseSchema = z.object({
  mbid: mbidSchema,
  title: z.string(),
  media: z.array(musicCatalogReleaseMediumSchema),
});

export type MusicCatalogRepresentativeRelease = z.infer<
  typeof musicCatalogRepresentativeReleaseSchema
>;

export const musicCatalogReleaseGroupSchema = z.object({
  mbid: mbidSchema,
  title: z.string(),
  /** Album, Single, EP, ...; null when MusicBrainz has none. */
  primaryType: z.string().nullable(),
  /** Compilation, Live, Remix, ... by name; empty when there are none. */
  secondaryTypes: z.array(z.string()),
  /**
   * The year of the earliest release event of any release in the group, of
   * any status: it matches MusicBrainz's first release date, and it can
   * predate the representative release (which prefers Official releases).
   * Null when none of the group's releases has a year.
   */
  firstReleaseYear: z.number().int().nullable(),
  /** The group's own genres, most voted first, by name on a tie. */
  genres: z.array(musicCatalogGenreSchema),
  /** The whole credit as printed, in credit order. */
  artistCredit: recordingArtistCreditSchema,
  /**
   * Cover Art Archive front cover of the release group, built from its MBID
   * alone, so always set (never null). The catalog does not know which groups
   * have art: a 404 means there is no cover, and consumers must treat it so.
   */
  coverArtUrl: z.string(),
  /** null only when the group has no releases. */
  representativeRelease: musicCatalogRepresentativeReleaseSchema.nullable(),
});

export type MusicCatalogReleaseGroup = z.infer<
  typeof musicCatalogReleaseGroupSchema
>;

/** What a client reads back for a `getReleaseGroup` request. */
export const musicCatalogGetReleaseGroupResponseSchema = z.discriminatedUnion(
  'ok',
  [
    musicCatalogSuccessResponseSchema(musicCatalogReleaseGroupSchema),
    musicCatalogErrorResponseSchema,
  ],
);

export type MusicCatalogGetReleaseGroupResponse = z.infer<
  typeof musicCatalogGetReleaseGroupResponseSchema
>;
