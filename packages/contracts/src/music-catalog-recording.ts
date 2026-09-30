import { z } from 'zod';
import {
  mbidSchema,
  musicCatalogErrorResponseSchema,
  musicCatalogSuccessResponseSchema,
} from './music-catalog.js';

// The Recording as the Music catalog describes it, returned by `getRecording`.
// Part of the Music catalog protocol (music-catalog.ts), kept in its own file
// so the envelope stays small. Every field is always present: what the catalog
// does not know is null or empty, never omitted, so the shape is stable.

/** `getRecording` payload: the MBID of the Recording. */
export const musicCatalogGetRecordingPayloadSchema = z.object({
  mbid: mbidSchema,
});

export type MusicCatalogGetRecordingPayload = z.infer<
  typeof musicCatalogGetRecordingPayloadSchema
>;

/** One artist of an artist credit, in credit order. */
export const recordingCreditedArtistSchema = z.object({
  mbid: mbidSchema,
  /** The artist's own name. */
  name: z.string(),
  /** The name this Recording credits the artist under. */
  creditedName: z.string(),
  /** Text that links this artist to the next one ("feat. ", " & "), or ''. */
  joinPhrase: z.string(),
});

export type RecordingCreditedArtist = z.infer<
  typeof recordingCreditedArtistSchema
>;

export const recordingArtistCreditSchema = z.object({
  /** The whole credit as printed, join phrases included. */
  name: z.string(),
  artists: z.array(recordingCreditedArtistSchema),
});

export type RecordingArtistCredit = z.infer<typeof recordingArtistCreditSchema>;

/**
 * A date MusicBrainz may know only in part: `YYYY`, `YYYY-MM` or
 * `YYYY-MM-DD`. No regex flags, see the contracts rules.
 */
export const partialDateSchema = z
  .string()
  .regex(/^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$/);

/**
 * One place the Recording appears on: a release and the track on it. A
 * Recording that is on two tracks of one release appears twice.
 */
export const recordingReleaseSchema = z.object({
  mbid: mbidSchema,
  title: z.string(),
  releaseGroup: z.object({
    mbid: mbidSchema,
    /** Album, Single, EP, ...; null when MusicBrainz has none. */
    primaryType: z.string().nullable(),
  }),
  /** Official, Promotion, Bootleg, ...; null when MusicBrainz has none. */
  status: z.string().nullable(),
  /** The release's earliest release event. */
  date: partialDateSchema.nullable(),
  /** ISO 3166-1 alpha-2 code of that release event, null when unknown. */
  country: z.string().nullable(),
  mediumPosition: z.number().int(),
  trackPosition: z.number().int(),
  /**
   * Cover Art Archive URL built from the release MBID. The catalog does not
   * know which releases have art, so it may answer 404.
   */
  coverArtUrl: z.string(),
});

export type RecordingRelease = z.infer<typeof recordingReleaseSchema>;

export const recordingWorkSchema = z.object({
  mbid: mbidSchema,
  title: z.string(),
});

export type RecordingWork = z.infer<typeof recordingWorkSchema>;

/** A tag that MusicBrainz also lists as a genre. `count` is the vote count. */
export const recordingGenreSchema = z.object({
  mbid: mbidSchema,
  name: z.string(),
  count: z.number().int(),
});

export type RecordingGenre = z.infer<typeof recordingGenreSchema>;

/** Any other tag. `count` is the vote count. */
export const recordingTagSchema = z.object({
  name: z.string(),
  count: z.number().int(),
});

export type RecordingTag = z.infer<typeof recordingTagSchema>;

/**
 * Where the genres and tags of a Recording came from: its own, else the
 * release groups' of the releases it is on, else its artists'.
 */
export const RECORDING_TAGS_SOURCES = [
  'recording',
  'release_group',
  'artist',
] as const;

export const recordingTagsSourceSchema = z.enum(RECORDING_TAGS_SOURCES);

export type RecordingTagsSource = z.infer<typeof recordingTagsSourceSchema>;

export const recordingExternalUrlSchema = z.object({
  url: z.string(),
  /** MusicBrainz's name for the relationship, e.g. "streaming music". */
  linkType: z.string(),
});

export type RecordingExternalUrl = z.infer<typeof recordingExternalUrlSchema>;

/** Plain and synced (LRC) Lyrics; both null when no Lyrics matched. */
export const recordingLyricsSchema = z.object({
  plain: z.string().nullable(),
  synced: z.string().nullable(),
});

export type RecordingLyrics = z.infer<typeof recordingLyricsSchema>;

export const recordingSchema = z.object({
  mbid: mbidSchema,
  title: z.string(),
  /** In milliseconds; null when MusicBrainz has none. */
  lengthMs: z.number().int().nullable(),
  /** Tells apart Recordings with the same title and artist; '' when none. */
  disambiguation: z.string(),
  /** Whether the Recording is a video. */
  video: z.boolean(),
  isrcs: z.array(z.string()),
  artistCredit: recordingArtistCreditSchema,
  releases: z.array(recordingReleaseSchema),
  works: z.array(recordingWorkSchema),
  genres: z.array(recordingGenreSchema),
  tags: z.array(recordingTagSchema),
  /** null when neither the Recording nor the fallbacks have any tag. */
  tagsSource: recordingTagsSourceSchema.nullable(),
  externalUrls: z.array(recordingExternalUrlSchema),
  lyrics: recordingLyricsSchema,
});

export type Recording = z.infer<typeof recordingSchema>;

/** What a client reads back for a `getRecording` request. */
export const musicCatalogGetRecordingResponseSchema = z.discriminatedUnion(
  'ok',
  [
    musicCatalogSuccessResponseSchema(recordingSchema),
    musicCatalogErrorResponseSchema,
  ],
);

export type MusicCatalogGetRecordingResponse = z.infer<
  typeof musicCatalogGetRecordingResponseSchema
>;
