import { integer, smallint, uuid, varchar } from 'drizzle-orm/pg-core';
import { musicbrainz } from './musicbrainz-schema.js';

export const artist = musicbrainz.table('artist', {
  id: integer().notNull(),
  gid: uuid().notNull(),
  name: varchar().notNull(),
});

/** The printed credit of a Recording, release or track. */
export const artistCredit = musicbrainz.table('artist_credit', {
  id: integer().notNull(),
  // The whole credit as printed, join phrases included.
  name: varchar().notNull(),
});

/** One artist of a credit. `position` orders them. */
export const artistCreditName = musicbrainz.table('artist_credit_name', {
  artistCredit: integer().notNull(),
  position: smallint().notNull(),
  artist: integer().notNull(),
  // The name the artist is credited under.
  name: varchar().notNull(),
  joinPhrase: varchar().notNull(),
});

export const artistTag = musicbrainz.table('artist_tag', {
  artist: integer().notNull(),
  tag: integer().notNull(),
  count: integer().notNull(),
});
