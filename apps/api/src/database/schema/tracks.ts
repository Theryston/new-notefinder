import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';

/**
 * Track catalog row with its core display columns: what the artist page
 * table scans (title, duration, ISRCs, genres) plus the disambiguation and
 * video flag that tell takes apart. The deeper MusicBrainz sections
 * (releases, works, tags, links) live in the companion tables below.
 * Starts empty: every search hit is unlinked until data is processed. One
 * Track per Recording (Recordings are never grouped).
 */
export const tracks = pgTable(
  'tracks',
  {
    id: id(),
    // The MBID of the MusicBrainz Recording, the only identity of a Track's
    // source. Unique, so the API can decide linked versus static per hit.
    recordingMbid: text().notNull(),
    // Display title, as the track table shows it. No default: the
    // contract requires a non-empty title, so a missing one must fail at
    // insert time, never as a 500 at read time.
    title: text().notNull(),
    // In milliseconds; null when MusicBrainz has none.
    lengthMs: integer(),
    // Tells apart Recordings with the same title and artist; '' when none.
    disambiguation: text().notNull().default(''),
    // Whether the Recording is a video.
    video: boolean().notNull().default(false),
    isrcs: text().array().notNull().default([]),
    // Display genres, most relevant first; empty when unknown.
    genres: text().array().notNull().default([]),
    ...timestamps,
  },
  (table) => [unique('tracks_recording_mbid_unique').on(table.recordingMbid)],
);

/**
 * Every release a Track's Recording appears on: what the expandable
 * releases section shows (title, year, cover art URL with fallback).
 * One Recording that is on two tracks of one release appears once per
 * release here (the track position is a Music catalog concern, not a
 * display one). Ordered by title in reads.
 */
export const trackReleases = pgTable(
  'track_releases',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    mbid: text().notNull(),
    title: text().notNull(),
    year: integer(),
    coverArtUrl: text(),
    ...timestamps,
  },
  (table) => [index().on(table.trackId)],
);

/**
 * Every work a Track's Recording links to: what the expandable works
 * section shows. Ordered by title in reads.
 */
export const trackWorks = pgTable(
  'track_works',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    mbid: text().notNull(),
    title: text().notNull(),
    ...timestamps,
  },
  (table) => [index().on(table.trackId)],
);

/**
 * Every tag of a Track's Recording: what the expandable tags section
 * shows, most voted first. Genres stay on the core row; tags are the
 * deeper exploration list.
 */
export const trackTags = pgTable(
  'track_tags',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    count: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [index().on(table.trackId)],
);

/**
 * Every external URL of a Track's Recording: what the expandable links
 * section shows (streaming, MusicBrainz). Ordered by link type in reads.
 */
export const trackExternalLinks = pgTable(
  'track_external_links',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    linkType: text().notNull(),
    ...timestamps,
  },
  (table) => [index().on(table.trackId)],
);

/**
 * Legacy ID map of the tracks table (see
 * `docs/adr/0001-reprocessed-catalog-with-legacy-id-maps.md`). Several
 * legacy IDs may point to one Track (legacy has duplicates).
 */
export const legacyTrackIds = pgTable(
  'legacy_track_ids',
  {
    legacyId: text().primaryKey(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
  },
  (table) => [index().on(table.trackId)],
);
