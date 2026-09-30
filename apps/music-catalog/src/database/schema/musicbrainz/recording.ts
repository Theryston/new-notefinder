import { boolean, char, integer, uuid, varchar } from 'drizzle-orm/pg-core';
import { musicbrainz } from './musicbrainz-schema.js';

export const recording = musicbrainz.table('recording', {
  id: integer().notNull(),
  gid: uuid().notNull(),
  name: varchar().notNull(),
  artistCredit: integer().notNull(),
  // Milliseconds.
  length: integer(),
  // The disambiguation comment; '' when there is none.
  comment: varchar({ length: 255 }).notNull(),
  video: boolean().notNull(),
});

/** An MBID that MusicBrainz merged away: `gid` now resolves to `newId`. */
export const recordingGidRedirect = musicbrainz.table(
  'recording_gid_redirect',
  {
    gid: uuid().notNull(),
    newId: integer().notNull(),
  },
);

export const isrc = musicbrainz.table('isrc', {
  recording: integer().notNull(),
  isrc: char({ length: 12 }).notNull(),
});

export const recordingTag = musicbrainz.table('recording_tag', {
  recording: integer().notNull(),
  tag: integer().notNull(),
  // Votes; a tag with no positive vote is not shown.
  count: integer().notNull(),
});
