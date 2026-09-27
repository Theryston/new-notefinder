import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { albums } from './albums.js';
import { artists } from './artists.js';
import { users } from './users.js';

// Values match the legacy Prisma enums 1:1, so the import copies them as-is.
export const trackStatus = pgEnum('track_status', [
  'QUEUED',
  'DOWNLOADING_THUMBNAILS',
  'DOWNLOADING_VIDEO',
  'EXTRACTING_LYRICS',
  'EXTRACTING_VOCALS',
  'DETECTING_VOCALS_NOTES',
  'ERROR',
  'COMPLETED',
]);

export const playingCopyright = pgEnum('playing_copyright', [
  'ALLOW_PLAY',
  'ALLOW_TRANSPOSE',
  'ALLOW_VOCALS_ONLY',
]);

export const tracks = pgTable(
  'tracks',
  {
    id: id(),
    // YouTube video ID. Not unique: legacy only looks for an existing track
    // before inserting (no constraint), so concurrent requests may have
    // created duplicates, and every legacy track ID must keep resolving.
    ytId: text().notNull(),
    // ID of the external note-detection job.
    jobId: text(),
    status: trackStatus().notNull().default('QUEUED'),
    statusDescription: text(),
    playingCopyright: playingCopyright().array().notNull().default([]),
    musicUrl: text(),
    musicMp3Url: text(),
    vocalsUrl: text(),
    vocalsMp3Url: text(),
    lyricsUrl: text(),
    // Metadata from YouTube Music; all nullable because legacy rows may miss
    // any of them. `duration` is the display string (e.g. "3:45").
    title: text(),
    duration: text(),
    durationSeconds: integer(),
    year: integer(),
    isExplicit: boolean(),
    // Legacy cascades album deletes to tracks; losing tracks (and their public
    // URLs) because an album row was removed is never intended.
    albumId: text().references(() => albums.id, { onDelete: 'set null' }),
    score: integer().notNull().default(0),
    // User who added the track. Required in legacy, where deleting the user
    // cascades to their tracks; here the track (a public page) survives and
    // just loses its creator.
    creatorId: text().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    index().on(table.ytId),
    index().on(table.albumId),
    index().on(table.creatorId),
    // Catalog listing: `where status = ? order by score desc, created_at
    // desc`; also serves lookups by status alone. Ascending columns on
    // purpose: Drizzle's `.desc()` emits NULLS LAST, which a plain
    // `order by ... desc` (NULLS FIRST) can't use, while a backward scan of
    // an ascending index matches it exactly.
    index().on(table.status, table.score, table.createdAt),
    index().on(table.score, table.createdAt),
    index().on(table.createdAt),
  ],
);

export const trackArtists = pgTable(
  'track_artists',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    artistId: text()
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  // No unique (track_id, artist_id): legacy has no such constraint.
  (table) => [index().on(table.trackId), index().on(table.artistId)],
);

export const thumbnails = pgTable(
  'thumbnails',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    width: integer(),
    height: integer(),
    ...timestamps,
  },
  (table) => [index().on(table.trackId)],
);

export const trackNotes = pgTable(
  'track_notes',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    // Pitch class as written by the note-detection worker (e.g. "C#").
    note: text().notNull(),
    octave: integer().notNull(),
    // Seconds from the start of the track.
    start: doublePrecision().notNull(),
    end: doublePrecision().notNull(),
    frequencyMean: doublePrecision().notNull(),
    // Optional author (nullable in legacy too). Legacy cascades user deletes
    // to notes; here the notes stay with their track.
    creatorId: text().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    index().on(table.trackId, table.start),
    // Lets a user delete set creator_id to null without scanning every note.
    index().on(table.creatorId),
  ],
);
