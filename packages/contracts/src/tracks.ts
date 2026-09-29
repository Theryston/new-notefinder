import { z } from 'zod';

import { cursorPageSchema, cursorPaginationQuerySchema } from './pagination.js';

/** A sung pitch as the note-detection worker writes it (e.g. `C#` 4). */
const noteSchema = z.object({
  // Pitch class with sharps only: C, C#, D, …, B.
  note: z.string(),
  octave: z.number().int(),
});

/** Lowest and highest notes sung in a track. */
const vocalRangeSchema = z.object({
  lowest: noteSchema,
  highest: noteSchema,
});

export type VocalRange = z.infer<typeof vocalRangeSchema>;

/** One size of a track's cover art. Legacy rows may miss the dimensions. */
const thumbnailSchema = z.object({
  url: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});

export type Thumbnail = z.infer<typeof thumbnailSchema>;

const trackArtistSchema = z.object({ id: z.string(), name: z.string() });

/**
 * What a track card needs: the track in lists (artist and album pages, and
 * later search, home and profiles). Metadata is nullable because legacy
 * tracks may miss any of it.
 */
export const trackSummarySchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  durationSeconds: z.number().int().nullable(),
  // In the order YouTube Music lists them; the first is the main artist.
  artists: z.array(trackArtistSchema),
  album: z.object({ id: z.string(), name: z.string() }).nullable(),
  // Every size available, so each client picks the one it renders.
  thumbnails: z.array(thumbnailSchema),
  // Null while the track has no detected notes.
  vocalRange: vocalRangeSchema.nullable(),
});

export type TrackSummary = z.infer<typeof trackSummarySchema>;

/** Tracks of an artist or album, most popular first. */
export const listTracksQuerySchema = cursorPaginationQuerySchema;

export type ListTracksQuery = z.infer<typeof listTracksQuerySchema>;

export const trackSummaryPageSchema = cursorPageSchema(trackSummarySchema);

export type TrackSummaryPage = z.infer<typeof trackSummaryPageSchema>;
