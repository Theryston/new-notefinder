import { z } from 'zod';

import { catalogTrackSchema } from './artists.js';
import { mbidSchema } from './music-catalog.js';
import { cursorPageSchema } from './pagination.js';

// The notefinder catalog's Album: a public entity with its own URL, backed by
// one MusicBrainz release group (every edition of one album, not a single
// release). Created when a Recording is reprocessed, never on reads. The
// header shows the cover, the title, the credited artists, the type line and
// the genre chips; its tracks are listed in album order, split by disc.

/** Route param for `GET /v1/albums/:id`: a new ID or a legacy ID. */
export const albumIdParamSchema = z.object({
  id: z.string().min(1).max(128),
});

export type AlbumIdParam = z.infer<typeof albumIdParamSchema>;

/** One Artist credited on an Album, in credit order. */
export const albumArtistSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
});

export type AlbumArtist = z.infer<typeof albumArtistSchema>;

export const albumSchema = z.object({
  id: z.string().min(1).max(128),
  /** The MusicBrainz release group MBID the Album was reprocessed from. */
  mbid: mbidSchema,
  /** Display title, as the header shows it. */
  title: z.string().min(1).max(500),
  /** MusicBrainz primary type (Album, Single, EP, Broadcast, Other); null when unknown. */
  primaryType: z.string().min(1).max(100).nullable(),
  /** MusicBrainz secondary types (Live, Compilation, ...); empty when none. */
  secondaryTypes: z.array(z.string().min(1).max(100)).max(30),
  /** Year of the first release; null when unknown. */
  year: z.number().int().min(1000).max(9999).nullable(),
  /** Display genres, most relevant first; empty when unknown. */
  genres: z.array(z.string().min(1).max(100)).max(30),
  /** Cover Art Archive URL built from the release group MBID; null when unknown. */
  coverArtUrl: z.string().min(1).max(2000).nullable(),
  /** How many processed Tracks are on the Album; zero when none are. */
  trackCount: z.number().int().nonnegative(),
  /** Every credited Artist, in MusicBrainz credit order. */
  artists: z.array(albumArtistSchema).max(30),
});

export type Album = z.infer<typeof albumSchema>;

/**
 * A disc (MusicBrainz medium) of an Album. `position` is the number
 * MusicBrainz gives the medium, from 1, so a heading can say "Disc N".
 */
export const albumDiscSchema = z.object({
  position: z.number().int().min(1).max(999),
  /** The disc's own name (e.g. "Bonus Disc"); null when it has none. */
  title: z.string().min(1).max(500).nullable(),
});

export type AlbumDisc = z.infer<typeof albumDiscSchema>;

/**
 * One processed Recording on an Album: the catalog track plus the disc it
 * sits on. The same Recording can be listed on several Albums, each with its
 * own disc.
 */
export const albumTrackSchema = catalogTrackSchema.extend({
  disc: albumDiscSchema,
});

export type AlbumTrack = z.infer<typeof albumTrackSchema>;

/**
 * One cursor page of an Album's tracks, in album order (disc, then track
 * position). `GET /v1/albums/:id/tracks` is its only use.
 */
export const albumTracksPageSchema = cursorPageSchema(albumTrackSchema);

export type AlbumTracksPage = z.infer<typeof albumTracksPageSchema>;
