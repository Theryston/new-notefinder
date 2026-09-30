import { integer, text, varchar } from 'drizzle-orm/pg-core';
import { musicbrainz } from './musicbrainz-schema.js';

export const url = musicbrainz.table('url', {
  id: integer().notNull(),
  url: text().notNull(),
});

export const link = musicbrainz.table('link', {
  id: integer().notNull(),
  linkType: integer().notNull(),
});

/** What a relationship means, e.g. "streaming music". */
export const linkType = musicbrainz.table('link_type', {
  id: integer().notNull(),
  name: varchar({ length: 255 }).notNull(),
});

/** Recording (`entity0`) to URL (`entity1`) relationships. */
export const lRecordingUrl = musicbrainz.table('l_recording_url', {
  link: integer().notNull(),
  entity0: integer().notNull(),
  entity1: integer().notNull(),
});
