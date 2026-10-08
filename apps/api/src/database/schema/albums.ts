import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { artists } from './artists.js';

/**
 * Notefinder catalog Album: a public entity with its own URL, backed by one
 * MusicBrainz release group (every edition of an album, never a single
 * release; see `docs/adr/0003-album-is-a-release-group.md`). Created when a
 * Recording is reprocessed; reads never call the Music catalog. The header
 * fields live on the row so the page renders without another lookup.
 */
export const albums = pgTable(
  'albums',
  {
    id: id(),
    // The MBID of the MusicBrainz release group, the only identity of an
    // Album's source. Unique, like an Artist's MBID.
    mbid: text().notNull(),
    title: text().notNull(),
    // MusicBrainz primary type (Album, Single, EP, Broadcast, Other); null
    // when MusicBrainz has none.
    primaryType: text(),
    // MusicBrainz secondary types (Live, Compilation, ...); empty when none.
    secondaryTypes: text().array().notNull().default([]),
    // Year of the first release; null when unknown.
    year: integer(),
    // Display genres, most relevant first; empty when unknown.
    genres: text().array().notNull().default([]),
    // Cover Art Archive URL of the release group; null when there is none.
    coverArtUrl: text(),
    ...timestamps,
  },
  (table) => [unique('albums_mbid_unique').on(table.mbid)],
);

/**
 * Legacy ID map of the albums table (see
 * `docs/adr/0001-reprocessed-catalog-with-legacy-id-maps.md`). Several
 * legacy IDs may point to one Album (legacy has duplicates).
 */
export const legacyAlbumIds = pgTable(
  'legacy_album_ids',
  {
    legacyId: text().primaryKey(),
    albumId: text()
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
  },
  (table) => [index().on(table.albumId)],
);

/**
 * The Artists credited on an Album, in MusicBrainz credit order. `position`
 * is the credit order (0-based, contiguous per Album), so the header lists
 * the artists as MusicBrainz credits them.
 */
export const albumArtists = pgTable(
  'album_artists',
  {
    albumId: text()
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    artistId: text()
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.albumId, table.artistId] }),
    unique('album_artists_position_unique').on(table.albumId, table.position),
    index().on(table.artistId),
  ],
);
