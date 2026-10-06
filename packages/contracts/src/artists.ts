import { z } from 'zod';

import { mbidSchema } from './music-catalog.js';

// The notefinder catalog's Artist: a public entity with its own URL,
// distinct from a MusicBrainz artist credit. Created when a Recording is
// reprocessed, never on reads. The header shows the name, an initials visual
// (no artist images in the catalog), the track count and the genres.

/** Route param for `GET /v1/artists/:id`: a new ID or a legacy ID. */
export const artistIdParamSchema = z.object({
  id: z.string().min(1).max(128),
});

export type ArtistIdParam = z.infer<typeof artistIdParamSchema>;

export const artistSchema = z.object({
  id: z.string().min(1).max(128),
  /** The MusicBrainz artist MBID the Artist was reprocessed from. */
  mbid: mbidSchema,
  /** Display name, as the header shows it. */
  name: z.string().min(1).max(200),
  /** Display genres, most relevant first; empty when unknown. */
  genres: z.array(z.string().min(1).max(100)).max(30),
  /** How many processed Tracks link to this Artist. */
  trackCount: z.number().int().nonnegative(),
});

export type Artist = z.infer<typeof artistSchema>;

/**
 * `details` of a 404 `RESOURCE_MOVED`: the ID the legacy ID points to, so
 * the web (and the future mobile app) can redirect without another lookup.
 */
export const resourceMovedDetailsSchema = z.object({
  id: z.string().min(1).max(128),
});

export type ResourceMovedDetails = z.infer<typeof resourceMovedDetailsSchema>;
