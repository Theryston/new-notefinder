import { char, integer, smallint, uuid, varchar } from 'drizzle-orm/pg-core';
import { musicbrainz } from './musicbrainz-schema.js';

export const release = musicbrainz.table('release', {
  id: integer().notNull(),
  gid: uuid().notNull(),
  name: varchar().notNull(),
  releaseGroup: integer().notNull(),
  status: integer(),
});

export const releaseGroup = musicbrainz.table('release_group', {
  id: integer().notNull(),
  gid: uuid().notNull(),
  type: integer(),
});

/** Album, Single, EP, ... */
export const releaseGroupPrimaryType = musicbrainz.table(
  'release_group_primary_type',
  {
    id: integer().notNull(),
    name: varchar({ length: 255 }).notNull(),
  },
);

/** Official, Promotion, Bootleg, ... */
export const releaseStatus = musicbrainz.table('release_status', {
  id: integer().notNull(),
  name: varchar({ length: 255 }).notNull(),
});

export const medium = musicbrainz.table('medium', {
  id: integer().notNull(),
  release: integer().notNull(),
  position: integer().notNull(),
});

/** One occurrence of a Recording on a medium of a release. */
export const track = musicbrainz.table('track', {
  recording: integer().notNull(),
  medium: integer().notNull(),
  position: integer().notNull(),
});

/** A release event in a known country; `country` is an area id. */
export const releaseCountry = musicbrainz.table('release_country', {
  release: integer().notNull(),
  country: integer().notNull(),
  dateYear: smallint(),
  dateMonth: smallint(),
  dateDay: smallint(),
});

/** A release event whose country is unknown. */
export const releaseUnknownCountry = musicbrainz.table(
  'release_unknown_country',
  {
    release: integer().notNull(),
    dateYear: smallint(),
    dateMonth: smallint(),
    dateDay: smallint(),
  },
);

/** The ISO 3166-1 alpha-2 code of a country area. */
export const iso31661 = musicbrainz.table('iso_3166_1', {
  area: integer().notNull(),
  code: char({ length: 2 }),
});

export const releaseGroupTag = musicbrainz.table('release_group_tag', {
  releaseGroup: integer().notNull(),
  tag: integer().notNull(),
  count: integer().notNull(),
});
