import { z } from 'zod';

import { localeSchema } from './locales.js';
import { mbidSchema } from './music-catalog.js';
import { trackProcessingSchema } from './track-processing.js';

// The Track requests and the Processing state of a Track, as the public API
// speaks them (`POST /v1/tracks`, `GET /v1/tracks/:trackId/processing`).

/** Route param of the Track routes: a new ID or a legacy ID. */
export const trackIdParamSchema = z.object({
  trackId: z.string().min(1).max(128),
});

export type TrackIdParam = z.infer<typeof trackIdParamSchema>;

/**
 * `POST /v1/tracks`: asks for a Recording to become a Track. `locale` is the
 * language the User is browsing in, which the User keeps for their emails.
 */
export const createTrackBodySchema = z.object({
  recordingMbid: mbidSchema,
  locale: localeSchema,
});

export type CreateTrackBody = z.infer<typeof createTrackBodySchema>;

/** The Track the request resolved to, new or existing. */
export const createTrackResultSchema = z.object({
  trackId: z.string().min(1).max(128),
});

export type CreateTrackResult = z.infer<typeof createTrackResultSchema>;

/**
 * `POST /v1/tracks/:trackId/processing/retry`: starts a new Processing of a
 * failed Track from the step that failed. `locale` is the language the User is
 * browsing in, which the User keeps for their emails.
 */
export const retryTrackBodySchema = z.object({
  locale: localeSchema,
});

export type RetryTrackBody = z.infer<typeof retryTrackBodySchema>;

/**
 * One credited artist of a Track, in credit order: the name as the credit
 * prints it and the text that joins it to the next one ("feat. ", " & ", or '').
 * The whole credit is what the header shows, from the moment the Track exists.
 */
export const trackArtistCreditEntrySchema = z.object({
  name: z.string().min(1).max(200),
  joinPhrase: z.string().max(100),
});

export type TrackArtistCreditEntry = z.infer<
  typeof trackArtistCreditEntrySchema
>;

/**
 * The Track header the Processing page shows. The cover is null until a
 * Processing finds one; the artist credit comes from the Recording the Track
 * was created from.
 */
export const trackHeaderSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(500),
  coverUrl: z.string().min(1).max(2000).nullable(),
  artistCredit: z.array(trackArtistCreditEntrySchema).max(30),
});

export type TrackHeader = z.infer<typeof trackHeaderSchema>;

/**
 * A User who did a Contribution to the Track. `id` identifies the Contributor
 * (one per Track and User) and keys the list; `username` is the link to their
 * Profile; `image` is their Avatar's URL, null without one.
 */
export const trackContributorSchema = z.object({
  id: z.string().min(1).max(128),
  username: z.string().min(1).max(100).nullable(),
  name: z.string().min(1).max(200),
  image: z.string().min(1).max(2000).nullable(),
});

export type TrackContributor = z.infer<typeof trackContributorSchema>;

/**
 * `GET /v1/tracks/:trackId/processing`: everything the Processing page shows.
 * `processing` is the latest Processing, or null for a Track that never had
 * one (only tracks imported without a pipeline run). Contributors come in the
 * order they first contributed.
 */
export const trackProcessingStateSchema = z.object({
  track: trackHeaderSchema,
  processing: trackProcessingSchema.nullable(),
  contributors: z.array(trackContributorSchema).max(100),
});

export type TrackProcessingState = z.infer<typeof trackProcessingStateSchema>;

/**
 * The limits on a User's Track requests (admins are exempt): how many
 * non-terminal Processings they may have started, and how many new Tracks they
 * may request per UTC day. Never rename one: the web translates them.
 */
export const TRACK_REQUEST_LIMITS = [
  'ACTIVE_PROCESSINGS',
  'NEW_TRACKS_PER_DAY',
] as const;

export const trackRequestLimitSchema = z.enum(TRACK_REQUEST_LIMITS);

export type TrackRequestLimit = z.infer<typeof trackRequestLimitSchema>;

/** `details` of a `PROCESSING_LIMIT_REACHED` answer: the limit hit and its maximum. */
export const processingLimitDetailsSchema = z.object({
  limit: trackRequestLimitSchema,
  max: z.number().int().positive(),
});

export type ProcessingLimitDetails = z.infer<
  typeof processingLimitDetailsSchema
>;

/**
 * One credited artist of a Track as the Track page shows it: the credit entry,
 * plus `artistId`, the Artist page the name links to (null while the credit has
 * no Artist in our catalog).
 */
export const linkedArtistCreditEntrySchema =
  trackArtistCreditEntrySchema.extend({
    artistId: z.string().min(1).max(128).nullable(),
  });

export type LinkedArtistCreditEntry = z.infer<
  typeof linkedArtistCreditEntrySchema
>;

/** The modes a Track's estimated key can have. */
export const TRACK_KEY_MODES = ['MAJOR', 'MINOR'] as const;

export const trackKeyModeSchema = z.enum(TRACK_KEY_MODES);

export type TrackKeyMode = z.infer<typeof trackKeyModeSchema>;

/**
 * The key a Track is estimated to be in: `tonic` is the pitch class (0 is C,
 * 11 is B) and `mode` is major or minor.
 */
export const trackKeySchema = z.object({
  tonic: z.number().int().min(0).max(11),
  mode: trackKeyModeSchema,
});

export type TrackKey = z.infer<typeof trackKeySchema>;

/**
 * The vocal range of a Track: its lowest and highest vocal note, as MIDI
 * numbers (A4 is 69).
 */
export const trackVocalRangeSchema = z.object({
  lowest: z.number().int().min(0).max(127),
  highest: z.number().int().min(0).max(127),
});

export type TrackVocalRange = z.infer<typeof trackVocalRangeSchema>;

/**
 * `GET /v1/tracks/:trackId`: the Track page's header. `durationMs` is null when
 * MusicBrainz has no length; `youtubeVideoId` is null until a Processing
 * chooses a video; `hasNotes` tells a Track with vocal notes from an
 * instrumental one; `viewCount` is how many times the Track was viewed.
 */
export const trackDetailSchema = trackHeaderSchema.extend({
  artistCredit: z.array(linkedArtistCreditEntrySchema).max(30),
  durationMs: z.number().int().nonnegative().nullable(),
  youtubeVideoId: z.string().min(1).max(32).nullable(),
  contributors: z.array(trackContributorSchema).max(100),
  hasNotes: z.boolean(),
  // Optional so clients built before the field keep parsing; the API always
  // sends it.
  viewCount: z.number().int().nonnegative().optional(),
  // Absent for a Track whose notes have no summary (an instrumental).
  vocalRange: trackVocalRangeSchema.optional(),
  key: trackKeySchema.optional(),
});

export type TrackDetail = z.infer<typeof trackDetailSchema>;

/**
 * One vocal note (CONTEXT.md): a single continuous pitch held from `start` to
 * `end`, in seconds from the start of the Track. `pitch` is a MIDI number
 * (A4 is 69) and may fall between two keys (a Zod number is always finite);
 * the note's name is the nearest key, which `pitchName` computes for every
 * client.
 */
export const trackNoteSchema = z.object({
  pitch: z.number(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
});

export type TrackNote = z.infer<typeof trackNoteSchema>;

/** `GET /v1/tracks/:trackId/notes`: the notes in the order they are sung. */
export const trackNotesSchema = z.object({
  notes: z.array(trackNoteSchema).max(20000),
});

export type TrackNotes = z.infer<typeof trackNotesSchema>;

/**
 * One word of the Timed lyrics (CONTEXT.md), timed to the Track's audio in
 * seconds from its start.
 */
export const trackLyricWordSchema = z.object({
  text: z.string().min(1).max(200),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
});

export type TrackLyricWord = z.infer<typeof trackLyricWordSchema>;

/** One line of the Timed lyrics: its span and the words sung in it, in order. */
export const trackLyricLineSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  words: z.array(trackLyricWordSchema).max(500),
});

export type TrackLyricLine = z.infer<typeof trackLyricLineSchema>;

/**
 * `GET /v1/tracks/:trackId/lyrics`: the Timed lyrics in the order they are
 * sung; no lines for a Track without any.
 */
export const trackLyricsSchema = z.object({
  lines: z.array(trackLyricLineSchema).max(2000),
});

export type TrackLyrics = z.infer<typeof trackLyricsSchema>;
