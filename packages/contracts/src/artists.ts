import { z } from 'zod';

import { mbidSchema } from './music-catalog.js';
import { cursorPageSchema } from './pagination.js';

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

/** One Artist of a Track row, in display order. */
export const artistTrackArtistSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
});

export type ArtistTrackArtist = z.infer<typeof artistTrackArtistSchema>;

/**
 * One processed Track on the artist page table: the core display columns
 * the singer scans to pick a song (title, artists, duration, ISRCs,
 * genres) plus the deeper MusicBrainz sections the row expands to show
 * (releases, works, tags, links). Stored in the API database when a
 * Recording is reprocessed, so reads never touch the Music catalog. One
 * entry per Recording. The deeper sections are optional for backward
 * compatibility and empty when the catalog has none.
 */
export const artistTrackReleaseSchema = z.object({
  mbid: mbidSchema,
  title: z.string().min(1).max(500),
  /** Release year derived from the earliest release event; null when unknown. */
  year: z.number().int().min(1000).max(9999).nullable(),
  /** Cover Art Archive URL built from the release MBID; null when unknown. */
  coverArtUrl: z.string().min(1).max(2000).nullable(),
});

export type ArtistTrackRelease = z.infer<typeof artistTrackReleaseSchema>;

export const artistTrackWorkSchema = z.object({
  mbid: mbidSchema,
  title: z.string().min(1).max(500),
});

export type ArtistTrackWork = z.infer<typeof artistTrackWorkSchema>;

export const artistTrackTagSchema = z.object({
  name: z.string().min(1).max(100),
  count: z.number().int().nonnegative(),
});

export type ArtistTrackTag = z.infer<typeof artistTrackTagSchema>;

export const artistTrackExternalLinkSchema = z.object({
  url: z.string().min(1).max(2000),
  /** MusicBrainz's name for the relationship, e.g. "streaming music". */
  linkType: z.string().min(1).max(100),
});

export type ArtistTrackExternalLink = z.infer<
  typeof artistTrackExternalLinkSchema
>;

export const artistTrackSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(500),
  /** In milliseconds; null when MusicBrainz has none. */
  lengthMs: z.number().int().nonnegative().nullable(),
  /** Tells apart Recordings with the same title and artist; '' when none. */
  disambiguation: z.string().max(500),
  /** Whether the Recording is a video. */
  video: z.boolean(),
  isrcs: z.array(z.string().min(1).max(32)).max(30),
  /** Every linked Artist, in alphabetical order; never empty. */
  artists: z.array(artistTrackArtistSchema).min(1).max(30),
  /** Display genres, most relevant first; empty when unknown. */
  genres: z.array(z.string().min(1).max(100)).max(30),
  /** Every release the Recording appears on, in title order; empty when none. */
  releases: z.array(artistTrackReleaseSchema).max(30).optional(),
  /** Every linked work, in title order; empty when none. */
  works: z.array(artistTrackWorkSchema).max(30).optional(),
  /** Every tag, most voted first; empty when none. */
  tags: z.array(artistTrackTagSchema).max(30).optional(),
  /** Every external URL, in link-type order; empty when none. */
  externalLinks: z.array(artistTrackExternalLinkSchema).max(30).optional(),
});

export type ArtistTrack = z.infer<typeof artistTrackSchema>;

/**
 * One page of `GET /v1/artists/:id/tracks`: cursor-paginated with one
 * entry per processed Recording, in stable `id` order. Cursors are opaque
 * base64url strings, never raw offsets.
 */
export const artistTracksPageSchema = cursorPageSchema(artistTrackSchema);

export type ArtistTracksPage = z.infer<typeof artistTracksPageSchema>;
