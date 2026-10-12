import { z } from 'zod';

import {
  trackArtistCreditEntrySchema,
  trackContributorSchema,
} from './tracks.js';

// What the Track practice page reads: the header (`GET /v1/tracks/:trackId`)
// and the vocal notes (`GET /v1/tracks/:trackId/notes`). Both are public.

/**
 * One credited artist of a Track. `artistId` is the Artist page the name links
 * to, null while the credit has no Artist in our catalog.
 */
export const trackPracticeArtistSchema = trackArtistCreditEntrySchema.extend({
  artistId: z.string().min(1).max(128).nullable(),
});

export type TrackPracticeArtist = z.infer<typeof trackPracticeArtistSchema>;

/**
 * `GET /v1/tracks/:trackId`: the header of the practice page. `durationMs` is
 * null when MusicBrainz has no length; `youtubeVideoId` is null until a
 * Processing chooses a video; `hasNotes` tells a Track with vocal notes from an
 * instrumental one.
 */
export const trackPracticeHeaderSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(500),
  coverUrl: z.string().min(1).max(2000).nullable(),
  artistCredit: z.array(trackPracticeArtistSchema).max(30),
  durationMs: z.number().int().nonnegative().nullable(),
  youtubeVideoId: z.string().min(1).max(32).nullable(),
  contributors: z.array(trackContributorSchema).max(100),
  hasNotes: z.boolean(),
});

export type TrackPracticeHeader = z.infer<typeof trackPracticeHeaderSchema>;

/** The twelve pitch class names, sharps as `#`. */
export const PITCH_CLASS_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

/**
 * One vocal note: its pitch class, its octave in MIDI numbering (`A4` is 4) and
 * when it is sung, in seconds from the start of the Track.
 */
export const trackNoteSchema = z.object({
  note: z.enum(PITCH_CLASS_NAMES),
  octave: z.number().int().min(-1).max(9),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
});

export type TrackNote = z.infer<typeof trackNoteSchema>;

/** `GET /v1/tracks/:trackId/notes`: the notes in the order they are sung. */
export const trackNotesSchema = z.object({
  notes: z.array(trackNoteSchema).max(20000),
});

export type TrackNotes = z.infer<typeof trackNotesSchema>;
