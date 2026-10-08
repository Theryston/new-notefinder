import { z } from 'zod';
import {
  mbidSchema,
  musicCatalogErrorResponseSchema,
  musicCatalogSuccessResponseSchema,
} from './music-catalog.js';
import {
  recordingArtistCreditSchema,
  recordingGenreSchema,
} from './music-catalog-recording.js';

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
 * The release the album's track order is taken from: the Official release
 * with the earliest release event, ties by MBID (chosen once, by the
 * catalog, so repeated calls agree).
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
   * The year of the earliest release event of any release in the group, null
   * when none of its releases has a year.
   */
  firstReleaseYear: z.number().int().nullable(),
  /** The group's own genres, most voted first, by name on a tie. */
  genres: z.array(recordingGenreSchema),
  /** The whole credit as printed, in credit order. */
  artistCredit: recordingArtistCreditSchema,
  /**
   * Cover Art Archive URL built from the release group MBID. The catalog does
   * not know which groups have art, so it may answer 404.
   */
  coverArtUrl: z.string(),
  /** null when no release of the group is Official. */
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
