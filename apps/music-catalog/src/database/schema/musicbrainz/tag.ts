import { integer, uuid, varchar } from 'drizzle-orm/pg-core';
import { musicbrainz } from './musicbrainz-schema.js';

export const tag = musicbrainz.table('tag', {
  id: integer().notNull(),
  name: varchar({ length: 255 }).notNull(),
});

/** The tags MusicBrainz also lists as genres; matched by name. */
export const genre = musicbrainz.table('genre', {
  gid: uuid().notNull(),
  name: varchar().notNull(),
});
